/**
 * EHR Connector Interface
 *
 * Supports multiple EHR systems:
 * - Epic (via FHIR R4 API)
 * - Cerner (via FHIR R4 API)
 * - Generic FHIR R4 servers
 *
 * HIPAA COMPLIANCE NOTES:
 * - All PHI data in transit must be encrypted (TLS 1.2+)
 * - OAuth 2.0 / SMART on FHIR for authentication
 * - All access must be logged via audit middleware
 * - Implement minimum necessary principle - only request needed data
 */

import { logAuditEvent } from '../middleware/audit';

// Supported EHR system types
export type EHRSystem = 'epic' | 'cerner' | 'generic_fhir';

// FHIR R4 Resource Types commonly used in patient portals
export type FHIRResourceType =
  | 'Patient'
  | 'Appointment'
  | 'Encounter'
  | 'Condition'
  | 'MedicationRequest'
  | 'AllergyIntolerance'
  | 'Observation'
  | 'DiagnosticReport'
  | 'Claim'
  | 'Coverage'
  | 'Practitioner'
  | 'Schedule'
  | 'Slot';

export interface EHRConfig {
  system: EHRSystem;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  // SMART on FHIR endpoints
  tokenEndpoint?: string;
  authorizeEndpoint?: string;
  // Optional: specific Epic/Cerner configurations
  epicClientId?: string;
  cernerSystemAccount?: string;
  // Timeout settings
  timeout?: number;
}

export interface PatientDemographics {
  id: string;
  mrn?: string; // Medical Record Number
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  // PHI - Handle with care
  address?: {
    line: string[];
    city: string;
    state: string;
    postalCode: string;
  };
  phone?: string;
  email?: string;
  // Insurance information
  primaryInsurance?: {
    payerId: string;
    payerName: string;
    memberId: string;
  };
}

export interface PatientSummary {
  patient: PatientDemographics;
  activeMedications: number;
  activeAllergies: number;
  upcomingAppointments: number;
  recentVisits: number;
  outstandingBalance?: number;
  lastVisitDate?: string;
}

export interface FHIRSearchResult<T> {
  resourceType: 'Bundle';
  total: number;
  entry: Array<{
    resource: T;
  }>;
}

/**
 * Abstract EHR Connector
 * Implementations for specific EHR systems should extend this class
 */
abstract class BaseEHRConnector {
  protected config: EHRConfig;
  protected accessToken: string | null = null;
  protected tokenExpiry: Date | null = null;

  constructor(config: EHRConfig) {
    this.config = config;
  }

  /**
   * Authenticate with the EHR system using OAuth 2.0
   * SECURITY: Tokens should be stored securely and refreshed before expiry
   */
  protected async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // In production, implement proper OAuth 2.0 flow
    // This is a placeholder for the authentication logic
    const tokenEndpoint = this.config.tokenEndpoint || `${this.config.baseUrl}/oauth2/token`;

    try {
      // Simulated token request - replace with actual OAuth implementation
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: 'patient/*.read user/*.read'
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);

      return this.accessToken!;
    } catch (error) {
      logAuditEvent(
        'SYSTEM_ERROR',
        {
          toolName: 'ehr_connector',
          resourceType: 'AUTHENTICATION'
        },
        'FAILURE',
        `EHR authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Make an authenticated FHIR API request
   * HIPAA: All requests are logged for audit trail
   */
  protected async fhirRequest<T>(
    resourceType: FHIRResourceType,
    path: string,
    patientId?: string
  ): Promise<T> {
    const token = await this.authenticate();
    const url = `${this.config.baseUrl}/${path}`;

    // Log the PHI access attempt
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'ehr_connector',
        resourceType: 'PATIENT_RECORD',
        patientId,
        parameters: { fhirResourceType: resourceType, path }
      },
      'SUCCESS'
    );

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FHIR request failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Abstract methods to be implemented by specific EHR connectors
  abstract getPatient(patientId: string): Promise<PatientDemographics>;
  abstract getPatientSummary(patientId: string): Promise<PatientSummary>;
  abstract searchPatients(query: string, limit?: number): Promise<PatientDemographics[]>;
}

/**
 * Generic FHIR R4 Connector
 * Works with any FHIR R4 compliant server
 */
export class GenericFHIRConnector extends BaseEHRConnector {
  async getPatient(patientId: string): Promise<PatientDemographics> {
    const patient = await this.fhirRequest<{
      id: string;
      identifier?: Array<{ system: string; value: string }>;
      name?: Array<{ family: string; given: string[] }>;
      birthDate?: string;
      gender?: string;
      address?: Array<{
        line?: string[];
        city?: string;
        state?: string;
        postalCode?: string;
      }>;
      telecom?: Array<{ system: string; value: string }>;
    }>('Patient', `Patient/${patientId}`, patientId);

    // Transform FHIR Patient resource to our interface
    const name = patient.name?.[0];
    const address = patient.address?.[0];
    const phone = patient.telecom?.find((t) => t.system === 'phone');
    const email = patient.telecom?.find((t) => t.system === 'email');
    const mrn = patient.identifier?.find((i) => i.system.includes('mrn') || i.system.includes('MRN'));

    return {
      id: patient.id,
      mrn: mrn?.value,
      firstName: name?.given?.join(' ') || 'Unknown',
      lastName: name?.family || 'Unknown',
      dateOfBirth: patient.birthDate || 'Unknown',
      gender: patient.gender || 'Unknown',
      address: address
        ? {
            line: address.line || [],
            city: address.city || '',
            state: address.state || '',
            postalCode: address.postalCode || ''
          }
        : undefined,
      phone: phone?.value,
      email: email?.value
    };
  }

  async getPatientSummary(patientId: string): Promise<PatientSummary> {
    const patient = await this.getPatient(patientId);

    // Fetch counts for summary (these would be actual FHIR queries in production)
    // Using _summary=count for efficiency
    const [medications, allergies, appointments, encounters] = await Promise.all([
      this.fhirRequest<FHIRSearchResult<unknown>>(
        'MedicationRequest',
        `MedicationRequest?patient=${patientId}&status=active&_summary=count`,
        patientId
      ),
      this.fhirRequest<FHIRSearchResult<unknown>>(
        'AllergyIntolerance',
        `AllergyIntolerance?patient=${patientId}&_summary=count`,
        patientId
      ),
      this.fhirRequest<FHIRSearchResult<unknown>>(
        'Appointment',
        `Appointment?patient=${patientId}&status=booked&_summary=count`,
        patientId
      ),
      this.fhirRequest<FHIRSearchResult<unknown>>(
        'Encounter',
        `Encounter?patient=${patientId}&_count=1&_sort=-date`,
        patientId
      )
    ]);

    return {
      patient,
      activeMedications: medications.total || 0,
      activeAllergies: allergies.total || 0,
      upcomingAppointments: appointments.total || 0,
      recentVisits: encounters.total || 0,
      lastVisitDate: encounters.entry?.[0]?.resource
        ? (encounters.entry[0].resource as { period?: { start?: string } }).period?.start
        : undefined
    };
  }

  async searchPatients(query: string, limit: number = 10): Promise<PatientDemographics[]> {
    // HIPAA: Patient searches must be logged and limited
    // Implement minimum necessary principle
    const searchResult = await this.fhirRequest<
      FHIRSearchResult<{
        id: string;
        identifier?: Array<{ system: string; value: string }>;
        name?: Array<{ family: string; given: string[] }>;
        birthDate?: string;
        gender?: string;
      }>
    >('Patient', `Patient?name=${encodeURIComponent(query)}&_count=${limit}`);

    return searchResult.entry?.map((entry) => {
      const patient = entry.resource;
      const name = patient.name?.[0];
      const mrn = patient.identifier?.find((i) => i.system.includes('mrn'));

      return {
        id: patient.id,
        mrn: mrn?.value,
        firstName: name?.given?.join(' ') || 'Unknown',
        lastName: name?.family || 'Unknown',
        dateOfBirth: patient.birthDate || 'Unknown',
        gender: patient.gender || 'Unknown'
        // Note: Address and contact info not returned in search for privacy
      };
    }) || [];
  }
}

/**
 * Epic FHIR Connector
 * Implements Epic-specific FHIR extensions and authentication
 */
export class EpicConnector extends GenericFHIRConnector {
  protected async authenticate(): Promise<string> {
    // Epic uses specific OAuth 2.0 flow with JWT assertion
    // Implement Epic's backend system authentication here
    // See: https://fhir.epic.com/Documentation?docId=oauth2

    // For now, use the base implementation
    // In production, implement Epic's JWT-based authentication
    return super.authenticate();
  }

  // Epic-specific methods can be added here
  // e.g., Epic's proprietary APIs for scheduling
}

/**
 * Cerner FHIR Connector
 * Implements Cerner-specific FHIR extensions and authentication
 */
export class CernerConnector extends GenericFHIRConnector {
  protected async authenticate(): Promise<string> {
    // Cerner uses system account authentication
    // Implement Cerner's specific OAuth flow here
    // See: https://fhir.cerner.com/authorization/

    return super.authenticate();
  }

  // Cerner-specific methods can be added here
}

// Singleton instance
let ehrConnector: BaseEHRConnector | null = null;

/**
 * Get the configured EHR connector instance
 * HIPAA: Connection credentials must be stored securely (not in code)
 */
export function getEHRConnector(): BaseEHRConnector {
  if (!ehrConnector) {
    const config: EHRConfig = {
      system: (process.env.EHR_SYSTEM as EHRSystem) || 'generic_fhir',
      baseUrl: process.env.EHR_BASE_URL || 'https://fhir.example.com/r4',
      clientId: process.env.EHR_CLIENT_ID || '',
      clientSecret: process.env.EHR_CLIENT_SECRET || '',
      tokenEndpoint: process.env.EHR_TOKEN_ENDPOINT,
      authorizeEndpoint: process.env.EHR_AUTHORIZE_ENDPOINT,
      timeout: parseInt(process.env.EHR_TIMEOUT || '30000', 10)
    };

    switch (config.system) {
      case 'epic':
        ehrConnector = new EpicConnector(config);
        break;
      case 'cerner':
        ehrConnector = new CernerConnector(config);
        break;
      default:
        ehrConnector = new GenericFHIRConnector(config);
    }
  }

  return ehrConnector;
}

export function resetEHRConnector(): void {
  ehrConnector = null;
}

export default { getEHRConnector, resetEHRConnector };
