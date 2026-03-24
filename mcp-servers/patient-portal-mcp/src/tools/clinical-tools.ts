/**
 * Clinical Tools
 *
 * MCP tools for accessing clinical patient data.
 *
 * HIPAA COMPLIANCE REQUIREMENTS:
 * - Clinical data is highly sensitive PHI
 * - All access must be logged with detailed audit trail
 * - Minimum necessary principle applies - only return needed data
 * - Consider additional access controls for sensitive data (HIV, mental health, substance abuse)
 *
 * 42 CFR Part 2 NOTE: Substance abuse treatment records require additional
 * patient consent beyond standard HIPAA authorization.
 */

import { z } from 'zod';
import { getEHRConnector } from '../connectors/ehr';
import { logAuditEvent } from '../middleware/audit';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  route: string;
  status: 'active' | 'completed' | 'stopped' | 'on-hold';
  prescribedDate: string;
  prescribedBy: string;
  pharmacy?: string;
  refillsRemaining?: number;
  instructions?: string;
  // Flags for special medications
  isControlled?: boolean;
  requiresAuth?: boolean;
}

export interface Allergy {
  id: string;
  allergen: string;
  allergenType: 'medication' | 'food' | 'environment' | 'other';
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction: string;
  onsetDate?: string;
  status: 'active' | 'inactive' | 'resolved';
  verifiedBy?: string;
  verifiedDate?: string;
  notes?: string;
}

export interface Visit {
  id: string;
  date: string;
  type: string;
  reason: string;
  providerName: string;
  facilityName: string;
  status: 'completed' | 'cancelled' | 'no-show';
  // Summary information - full notes require separate access
  summary?: string;
  diagnoses?: Array<{
    code: string;
    description: string;
  }>;
  followUpRecommended?: boolean;
  followUpDate?: string;
}

export interface LabResult {
  id: string;
  testName: string;
  testCode?: string;
  collectionDate: string;
  resultDate: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  status: 'final' | 'preliminary' | 'corrected' | 'cancelled';
  interpretation?: 'normal' | 'abnormal' | 'critical';
  performingLab?: string;
  orderingProvider?: string;
  notes?: string;
}

// ============================================================================
// Schema Definitions
// ============================================================================

export const getMedicationsSchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier'),
  status: z
    .enum(['active', 'all'])
    .default('active')
    .optional()
    .describe('Filter by medication status (active or all)')
});

export const getAllergiesSchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier')
});

export const getRecentVisitsSchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Maximum number of visits to return (1-50, default: 10)')
});

export const getLabResultsSchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .optional()
    .describe('Maximum number of results to return (1-100, default: 20)'),
  test_type: z.string().optional().describe('Optional: filter by test type/code')
});

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Get current medications for a patient
 *
 * HIPAA NOTE: Medication lists contain sensitive PHI including:
 * - Medication names (may indicate conditions)
 * - Prescribing providers
 * - Dosage and frequency information
 *
 * SPECIAL CONSIDERATIONS:
 * - Controlled substances may require additional access verification
 * - Some medications (HIV, psychiatric) may have additional privacy protections
 */
export async function getMedications(
  params: z.infer<typeof getMedicationsSchema>
): Promise<{
  medications: Medication[];
  total: number;
  activeCount: number;
}> {
  const { patient_id, status = 'active' } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_medications',
      resourceType: 'MEDICATION',
      patientId: patient_id,
      parameters: { status },
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'Retrieving patient medications'
  );

  try {
    // In production, this would query the EHR for FHIR MedicationRequest resources
    // Simulated response for structure demonstration
    const medications: Medication[] = [
      {
        id: 'med-001',
        name: 'Lisinopril',
        genericName: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        route: 'Oral',
        status: 'active',
        prescribedDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        prescribedBy: 'Dr. Smith',
        refillsRemaining: 3,
        instructions: 'Take in the morning with or without food'
      },
      {
        id: 'med-002',
        name: 'Metformin',
        genericName: 'Metformin HCl',
        dosage: '500mg',
        frequency: 'Twice daily',
        route: 'Oral',
        status: 'active',
        prescribedDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        prescribedBy: 'Dr. Johnson',
        refillsRemaining: 2,
        instructions: 'Take with meals'
      },
      {
        id: 'med-003',
        name: 'Atorvastatin',
        genericName: 'Atorvastatin Calcium',
        dosage: '20mg',
        frequency: 'Once daily at bedtime',
        route: 'Oral',
        status: 'active',
        prescribedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        prescribedBy: 'Dr. Smith',
        refillsRemaining: 5,
        instructions: 'Take at bedtime'
      }
    ];

    // Filter by status if requested
    const filteredMedications =
      status === 'active' ? medications.filter((m) => m.status === 'active') : medications;

    // Log successful retrieval
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_medications',
        resourceType: 'MEDICATION',
        patientId: patient_id,
        parameters: { medicationCount: filteredMedications.length }
      },
      'SUCCESS',
      `Retrieved ${filteredMedications.length} medications`
    );

    return {
      medications: filteredMedications,
      total: filteredMedications.length,
      activeCount: medications.filter((m) => m.status === 'active').length
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_medications',
        resourceType: 'MEDICATION',
        patientId: patient_id
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Get patient allergies
 *
 * HIPAA NOTE: Allergy information is critical PHI for patient safety.
 * Must be accurate and readily accessible for treatment purposes.
 */
export async function getAllergies(
  params: z.infer<typeof getAllergiesSchema>
): Promise<{
  allergies: Allergy[];
  total: number;
  hasSevereAllergies: boolean;
}> {
  const { patient_id } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_allergies',
      resourceType: 'ALLERGY',
      patientId: patient_id,
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'Retrieving patient allergies'
  );

  try {
    // In production, query FHIR AllergyIntolerance resources
    const allergies: Allergy[] = [
      {
        id: 'allergy-001',
        allergen: 'Penicillin',
        allergenType: 'medication',
        severity: 'severe',
        reaction: 'Anaphylaxis',
        onsetDate: '2015-03-15',
        status: 'active',
        verifiedBy: 'Dr. Smith',
        verifiedDate: '2020-01-10',
        notes: 'Patient carries EpiPen. Cross-reactivity with cephalosporins possible.'
      },
      {
        id: 'allergy-002',
        allergen: 'Shellfish',
        allergenType: 'food',
        severity: 'moderate',
        reaction: 'Hives, facial swelling',
        onsetDate: '2018-07-22',
        status: 'active',
        notes: 'Includes shrimp, crab, lobster'
      },
      {
        id: 'allergy-003',
        allergen: 'Latex',
        allergenType: 'environment',
        severity: 'mild',
        reaction: 'Contact dermatitis',
        status: 'active'
      }
    ];

    const hasSevere = allergies.some(
      (a) => a.status === 'active' && (a.severity === 'severe' || a.severity === 'life-threatening')
    );

    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_allergies',
        resourceType: 'ALLERGY',
        patientId: patient_id,
        parameters: { allergyCount: allergies.length, hasSevereAllergies: hasSevere }
      },
      'SUCCESS',
      `Retrieved ${allergies.length} allergies`
    );

    return {
      allergies,
      total: allergies.length,
      hasSevereAllergies: hasSevere
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_allergies',
        resourceType: 'ALLERGY',
        patientId: patient_id
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Get recent visit summaries
 *
 * HIPAA NOTE: Visit summaries may contain:
 * - Diagnoses and conditions
 * - Treatment information
 * - Provider notes (summarized)
 *
 * Full clinical notes typically require additional access controls.
 */
export async function getRecentVisits(
  params: z.infer<typeof getRecentVisitsSchema>
): Promise<{
  visits: Visit[];
  total: number;
}> {
  const { patient_id, limit = 10 } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_recent_visits',
      resourceType: 'CLINICAL_NOTE',
      patientId: patient_id,
      parameters: { limit },
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'Retrieving recent visits'
  );

  try {
    // In production, query FHIR Encounter resources
    const visits: Visit[] = [
      {
        id: 'visit-001',
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: 'Office Visit',
        reason: 'Follow-up for hypertension',
        providerName: 'Dr. Smith',
        facilityName: 'Main Clinic',
        status: 'completed',
        summary: 'Blood pressure well controlled on current medication. Continue current regimen.',
        diagnoses: [
          { code: 'I10', description: 'Essential hypertension' }
        ],
        followUpRecommended: true,
        followUpDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      {
        id: 'visit-002',
        date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: 'Lab Visit',
        reason: 'Routine blood work',
        providerName: 'Dr. Johnson',
        facilityName: 'Laboratory Services',
        status: 'completed',
        summary: 'Comprehensive metabolic panel and lipid panel completed.'
      },
      {
        id: 'visit-003',
        date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: 'Annual Physical',
        reason: 'Annual wellness examination',
        providerName: 'Dr. Smith',
        facilityName: 'Main Clinic',
        status: 'completed',
        summary: 'Annual physical completed. All screenings up to date. Counseled on diet and exercise.',
        diagnoses: [
          { code: 'Z00.00', description: 'General adult medical examination' },
          { code: 'I10', description: 'Essential hypertension' },
          { code: 'E11.9', description: 'Type 2 diabetes mellitus' }
        ],
        followUpRecommended: true
      }
    ];

    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_recent_visits',
        resourceType: 'CLINICAL_NOTE',
        patientId: patient_id,
        parameters: { visitCount: visits.length }
      },
      'SUCCESS',
      `Retrieved ${visits.length} recent visits`
    );

    return {
      visits: visits.slice(0, limit),
      total: visits.length
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_recent_visits',
        resourceType: 'CLINICAL_NOTE',
        patientId: patient_id
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Get recent lab results
 *
 * HIPAA NOTE: Lab results are sensitive PHI that may reveal:
 * - Medical conditions
 * - Disease states
 * - Treatment monitoring
 *
 * Critical/abnormal results should be flagged for clinical attention.
 */
export async function getLabResults(
  params: z.infer<typeof getLabResultsSchema>
): Promise<{
  results: LabResult[];
  total: number;
  abnormalCount: number;
  criticalCount: number;
}> {
  const { patient_id, limit = 20, test_type } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_lab_results',
      resourceType: 'LAB_RESULT',
      patientId: patient_id,
      parameters: { limit, test_type },
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'Retrieving lab results'
  );

  try {
    // In production, query FHIR Observation and DiagnosticReport resources
    const results: LabResult[] = [
      {
        id: 'lab-001',
        testName: 'Hemoglobin A1c',
        testCode: '4548-4',
        collectionDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        resultDate: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: '6.8',
        unit: '%',
        referenceRange: '< 5.7%',
        status: 'final',
        interpretation: 'abnormal',
        performingLab: 'Quest Diagnostics',
        orderingProvider: 'Dr. Smith',
        notes: 'Indicates diabetes. Target < 7% for diabetic patients.'
      },
      {
        id: 'lab-002',
        testName: 'Glucose, Fasting',
        testCode: '1558-6',
        collectionDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        resultDate: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: '142',
        unit: 'mg/dL',
        referenceRange: '70-99 mg/dL',
        status: 'final',
        interpretation: 'abnormal',
        performingLab: 'Quest Diagnostics',
        orderingProvider: 'Dr. Smith'
      },
      {
        id: 'lab-003',
        testName: 'LDL Cholesterol',
        testCode: '13457-7',
        collectionDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        resultDate: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: '98',
        unit: 'mg/dL',
        referenceRange: '< 100 mg/dL',
        status: 'final',
        interpretation: 'normal',
        performingLab: 'Quest Diagnostics',
        orderingProvider: 'Dr. Smith'
      },
      {
        id: 'lab-004',
        testName: 'Creatinine',
        testCode: '2160-0',
        collectionDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        resultDate: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: '0.9',
        unit: 'mg/dL',
        referenceRange: '0.7-1.3 mg/dL',
        status: 'final',
        interpretation: 'normal',
        performingLab: 'Quest Diagnostics',
        orderingProvider: 'Dr. Smith'
      },
      {
        id: 'lab-005',
        testName: 'eGFR',
        testCode: '33914-3',
        collectionDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        resultDate: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        value: '92',
        unit: 'mL/min/1.73m2',
        referenceRange: '>= 60 mL/min/1.73m2',
        status: 'final',
        interpretation: 'normal',
        performingLab: 'Quest Diagnostics',
        orderingProvider: 'Dr. Smith'
      }
    ];

    // Filter by test type if specified
    const filteredResults = test_type
      ? results.filter((r) => r.testCode === test_type || r.testName.toLowerCase().includes(test_type.toLowerCase()))
      : results;

    const abnormalCount = filteredResults.filter((r) => r.interpretation === 'abnormal').length;
    const criticalCount = filteredResults.filter((r) => r.interpretation === 'critical').length;

    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_lab_results',
        resourceType: 'LAB_RESULT',
        patientId: patient_id,
        parameters: { resultCount: filteredResults.length, abnormalCount, criticalCount }
      },
      'SUCCESS',
      `Retrieved ${filteredResults.length} lab results`
    );

    return {
      results: filteredResults.slice(0, limit),
      total: filteredResults.length,
      abnormalCount,
      criticalCount
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_lab_results',
        resourceType: 'LAB_RESULT',
        patientId: patient_id
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
    name: 'get_medications',
    description: `Get current medications for a patient including dosage, frequency, and prescribing information.
    Can filter by status (active only or all medications).
    HIPAA: Medication data is PHI. All access is logged for audit compliance.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        patient_id: {
          type: 'string',
          description: 'The unique patient identifier'
        },
        status: {
          type: 'string',
          enum: ['active', 'all'],
          description: 'Filter by medication status (active or all)',
          default: 'active'
        }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'get_allergies',
    description: `Get patient allergies including allergen, severity, and reaction information.
    Flags patients with severe or life-threatening allergies.
    HIPAA: Allergy data is PHI. All access is logged for audit compliance.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        patient_id: {
          type: 'string',
          description: 'The unique patient identifier'
        }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'get_recent_visits',
    description: `Get recent visit summaries for a patient including diagnoses and follow-up recommendations.
    Returns summarized visit information, not full clinical notes.
    HIPAA: Visit data is PHI. All access is logged for audit compliance.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        patient_id: {
          type: 'string',
          description: 'The unique patient identifier'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of visits to return (1-50, default: 10)',
          minimum: 1,
          maximum: 50,
          default: 10
        }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'get_lab_results',
    description: `Get recent lab results for a patient including values, reference ranges, and interpretations.
    Flags abnormal and critical results for attention.
    HIPAA: Lab results are PHI. All access is logged for audit compliance.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        patient_id: {
          type: 'string',
          description: 'The unique patient identifier'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (1-100, default: 20)',
          minimum: 1,
          maximum: 100,
          default: 20
        },
        test_type: {
          type: 'string',
          description: 'Optional: filter by test type or code (e.g., "glucose", "4548-4")'
        }
      },
      required: ['patient_id']
    }
  }
];
