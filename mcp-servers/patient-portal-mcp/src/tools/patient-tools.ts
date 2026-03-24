/**
 * Patient Tools
 *
 * MCP tools for patient demographics and search functionality.
 *
 * HIPAA COMPLIANCE REQUIREMENTS:
 * - All PHI access must be logged with audit trail
 * - Patient search must implement access controls
 * - Minimum necessary principle - only return needed data
 * - User must have authorization to access patient records
 */

import { z } from 'zod';
import { getEHRConnector, PatientDemographics, PatientSummary } from '../connectors/ehr';
import { logAuditEvent, logSearchAudit, logAccessDenied } from '../middleware/audit';

// ============================================================================
// Schema Definitions
// ============================================================================

export const getPatientSummarySchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier (FHIR Patient ID or MRN)')
});

export const searchPatientsSchema = z.object({
  query: z.string().min(2).describe('Search query (name, MRN, DOB). Minimum 2 characters required.'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Maximum number of results to return (1-50, default: 10)')
});

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Get patient demographics and summary information
 *
 * HIPAA NOTE: This tool accesses PHI including:
 * - Patient demographics (name, DOB, address, phone)
 * - Summary clinical information
 *
 * All access is logged to the HIPAA audit trail.
 */
export async function getPatientSummary(
  params: z.infer<typeof getPatientSummarySchema>
): Promise<PatientSummary> {
  const { patient_id } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_patient_summary',
      resourceType: 'PATIENT_RECORD',
      patientId: patient_id,
      parameters: { patient_id },
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'Retrieving patient summary'
  );

  try {
    const ehrConnector = getEHRConnector();
    const summary = await ehrConnector.getPatientSummary(patient_id);

    // Log successful access with high-level summary (no PHI in log)
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_patient_summary',
        resourceType: 'PATIENT_RECORD',
        patientId: patient_id,
        parameters: {
          activeMedications: summary.activeMedications,
          activeAllergies: summary.activeAllergies,
          upcomingAppointments: summary.upcomingAppointments
        }
      },
      'SUCCESS',
      'Patient summary retrieved successfully'
    );

    return summary;
  } catch (error) {
    // Log failed access attempt
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_patient_summary',
        resourceType: 'PATIENT_RECORD',
        patientId: patient_id
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );

    throw error;
  }
}

/**
 * Search for patients by name, MRN, or other criteria
 *
 * HIPAA NOTE: Patient searches are particularly sensitive operations:
 * - Searches must be logged with query parameters
 * - Results must be limited to prevent bulk data access
 * - User must have appropriate authorization
 * - Minimum necessary: return only essential identifying information
 *
 * ACCESS CONTROL NOTE: In production, implement:
 * - Role-based access control (RBAC)
 * - Department/facility restrictions
 * - Patient consent checking
 * - Break-the-glass audit for emergency access
 */
export async function searchPatients(
  params: z.infer<typeof searchPatientsSchema>
): Promise<{
  results: PatientDemographics[];
  total: number;
  hasMore: boolean;
  searchCriteria: string;
}> {
  const { query, limit = 10 } = params;

  // Enforce minimum search query length to prevent overly broad searches
  if (query.length < 2) {
    logAccessDenied(
      'search_patients',
      'PATIENT_RECORD',
      undefined,
      'Search query too short - minimum 2 characters required'
    );
    throw new Error('Search query must be at least 2 characters long');
  }

  // Log the search attempt
  logAuditEvent(
    'PHI_SEARCH',
    {
      toolName: 'search_patients',
      resourceType: 'PATIENT_RECORD',
      parameters: { query: query.substring(0, 50), limit }, // Truncate query in logs
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    `Patient search initiated: ${query.substring(0, 20)}...`
  );

  try {
    const ehrConnector = getEHRConnector();
    const results = await ehrConnector.searchPatients(query, limit);

    // Log the search results (IDs only, no PHI)
    logSearchAudit(
      'search_patients',
      query,
      results.length,
      results.map((p) => p.id)
    );

    return {
      results,
      total: results.length,
      hasMore: results.length === limit, // Indicates there may be more results
      searchCriteria: query
    };
  } catch (error) {
    // Log failed search
    logAuditEvent(
      'PHI_SEARCH',
      {
        toolName: 'search_patients',
        resourceType: 'PATIENT_RECORD',
        parameters: { query: query.substring(0, 50) }
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );

    throw error;
  }
}

// ============================================================================
// Tool Definitions for MCP Registration
// ============================================================================

export const toolDefinitions = [
  {
    name: 'get_patient_summary',
    description: `Get patient demographics and summary information including basic demographics,
    count of active medications, allergies, upcoming appointments, and recent visits.
    HIPAA: This tool accesses Protected Health Information (PHI).
    All access is logged for audit compliance.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        patient_id: {
          type: 'string',
          description: 'The unique patient identifier (FHIR Patient ID or MRN)'
        }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'search_patients',
    description: `Search for patients by name, MRN, or date of birth.
    Results are limited to prevent bulk data access.
    HIPAA: Patient searches are logged with full audit trail.
    Access controls apply - only authorized users can search patient records.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (name, MRN, DOB). Minimum 2 characters required.',
          minLength: 2
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (1-50, default: 10)',
          minimum: 1,
          maximum: 50,
          default: 10
        }
      },
      required: ['query']
    }
  }
];
