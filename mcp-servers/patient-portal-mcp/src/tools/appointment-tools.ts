/**
 * Appointment Tools
 *
 * MCP tools for appointment management functionality.
 *
 * HIPAA COMPLIANCE REQUIREMENTS:
 * - Appointment information is PHI when linked to patient identity
 * - All access must be logged with audit trail
 * - Patient authorization verification required
 */

import { z } from 'zod';
import {
  getSchedulingConnector,
  Appointment,
  AppointmentSlot,
  DateRange
} from '../connectors/scheduling';
import { logAuditEvent } from '../middleware/audit';

// ============================================================================
// Schema Definitions
// ============================================================================

export const listAppointmentsSchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier'),
  date_range: z
    .object({
      start: z.string().describe('Start date in ISO 8601 format (YYYY-MM-DD)'),
      end: z.string().describe('End date in ISO 8601 format (YYYY-MM-DD)')
    })
    .optional()
    .describe('Optional date range to filter appointments')
});

export const getAppointmentSchema = z.object({
  appointment_id: z.string().min(1).describe('The unique appointment identifier')
});

export const getAvailableSlotsSchema = z.object({
  provider_id: z.string().min(1).describe('The provider/practitioner identifier'),
  date_range: z
    .object({
      start: z.string().describe('Start date in ISO 8601 format (YYYY-MM-DD)'),
      end: z.string().describe('End date in ISO 8601 format (YYYY-MM-DD)')
    })
    .describe('Date range to search for available slots')
});

export const getUpcomingAppointmentsSchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier'),
  count: z
    .number()
    .min(1)
    .max(20)
    .default(5)
    .optional()
    .describe('Number of upcoming appointments to return (1-20, default: 5)')
});

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * List all appointments for a patient
 *
 * HIPAA NOTE: Appointment data includes:
 * - Patient identity
 * - Provider information
 * - Date/time and reason for visit
 *
 * All access is logged to the HIPAA audit trail.
 */
export async function listAppointments(
  params: z.infer<typeof listAppointmentsSchema>
): Promise<{
  appointments: Appointment[];
  total: number;
  dateRange?: DateRange;
}> {
  const { patient_id, date_range } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'list_appointments',
      resourceType: 'APPOINTMENT',
      patientId: patient_id,
      parameters: { date_range },
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'Retrieving patient appointments'
  );

  try {
    const schedulingConnector = getSchedulingConnector();
    const appointments = await schedulingConnector.getPatientAppointments(patient_id, date_range);

    // Log successful retrieval
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'list_appointments',
        resourceType: 'APPOINTMENT',
        patientId: patient_id,
        parameters: { appointmentCount: appointments.length }
      },
      'SUCCESS',
      `Retrieved ${appointments.length} appointments`
    );

    return {
      appointments,
      total: appointments.length,
      dateRange: date_range
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'list_appointments',
        resourceType: 'APPOINTMENT',
        patientId: patient_id
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Get details for a specific appointment
 *
 * HIPAA NOTE: Returns detailed appointment information including:
 * - Patient and provider details
 * - Appointment reason
 * - Location and instructions
 * - Telehealth access information (if applicable)
 */
export async function getAppointment(
  params: z.infer<typeof getAppointmentSchema>
): Promise<Appointment | null> {
  const { appointment_id } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_appointment',
      resourceType: 'APPOINTMENT',
      resourceId: appointment_id,
      parameters: { appointment_id },
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'Retrieving appointment details'
  );

  try {
    const schedulingConnector = getSchedulingConnector();
    const appointment = await schedulingConnector.getAppointment(appointment_id);

    if (appointment) {
      // Log successful retrieval with patient ID
      logAuditEvent(
        'PHI_ACCESS',
        {
          toolName: 'get_appointment',
          resourceType: 'APPOINTMENT',
          resourceId: appointment_id,
          patientId: appointment.patientId
        },
        'SUCCESS',
        'Appointment details retrieved'
      );
    } else {
      logAuditEvent(
        'PHI_ACCESS',
        {
          toolName: 'get_appointment',
          resourceType: 'APPOINTMENT',
          resourceId: appointment_id
        },
        'FAILURE',
        'Appointment not found'
      );
    }

    return appointment;
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_appointment',
        resourceType: 'APPOINTMENT',
        resourceId: appointment_id
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Get available appointment slots for a provider
 *
 * NOTE: Available slots themselves are not PHI (no patient info),
 * but we still log access for operational audit purposes.
 */
export async function getAvailableSlots(
  params: z.infer<typeof getAvailableSlotsSchema>
): Promise<{
  slots: AppointmentSlot[];
  total: number;
  provider_id: string;
  dateRange: DateRange;
}> {
  const { provider_id, date_range } = params;

  // Log access (not PHI, but good for operational audit)
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_available_slots',
      resourceType: 'APPOINTMENT',
      parameters: { provider_id, date_range },
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'Retrieving available appointment slots'
  );

  try {
    const schedulingConnector = getSchedulingConnector();
    const slots = await schedulingConnector.getAvailableSlots(provider_id, date_range);

    return {
      slots,
      total: slots.length,
      provider_id,
      dateRange: date_range
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_available_slots',
        resourceType: 'APPOINTMENT',
        parameters: { provider_id }
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Get upcoming appointments for a patient
 *
 * HIPAA NOTE: Returns the next scheduled appointments for the patient.
 * Useful for quick access to near-term scheduling information.
 */
export async function getUpcomingAppointments(
  params: z.infer<typeof getUpcomingAppointmentsSchema>
): Promise<{
  appointments: Appointment[];
  total: number;
  nextAppointment: Appointment | null;
}> {
  const { patient_id, count = 5 } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_upcoming_appointments',
      resourceType: 'APPOINTMENT',
      patientId: patient_id,
      parameters: { count },
      purposeOfUse: 'TREATMENT'
    },
    'SUCCESS',
    'Retrieving upcoming appointments'
  );

  try {
    const schedulingConnector = getSchedulingConnector();
    const appointments = await schedulingConnector.getUpcomingAppointments(patient_id, count);

    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_upcoming_appointments',
        resourceType: 'APPOINTMENT',
        patientId: patient_id,
        parameters: { appointmentCount: appointments.length }
      },
      'SUCCESS',
      `Retrieved ${appointments.length} upcoming appointments`
    );

    return {
      appointments,
      total: appointments.length,
      nextAppointment: appointments.length > 0 ? appointments[0] : null
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_upcoming_appointments',
        resourceType: 'APPOINTMENT',
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
    name: 'list_appointments',
    description: `List all appointments for a patient, optionally filtered by date range.
    Returns appointment details including provider, time, status, and location.
    HIPAA: This tool accesses PHI. All access is logged for audit compliance.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        patient_id: {
          type: 'string',
          description: 'The unique patient identifier'
        },
        date_range: {
          type: 'object',
          description: 'Optional date range to filter appointments',
          properties: {
            start: {
              type: 'string',
              description: 'Start date in ISO 8601 format (YYYY-MM-DD)'
            },
            end: {
              type: 'string',
              description: 'End date in ISO 8601 format (YYYY-MM-DD)'
            }
          },
          required: ['start', 'end']
        }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'get_appointment',
    description: `Get detailed information for a specific appointment.
    Returns full appointment details including provider, reason, location, and instructions.
    HIPAA: This tool accesses PHI. All access is logged for audit compliance.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        appointment_id: {
          type: 'string',
          description: 'The unique appointment identifier'
        }
      },
      required: ['appointment_id']
    }
  },
  {
    name: 'get_available_slots',
    description: `Get available appointment slots for a provider within a date range.
    Returns open time slots that can be used for booking appointments.
    Note: Available slots do not contain PHI but access is logged for operational audit.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        provider_id: {
          type: 'string',
          description: 'The provider/practitioner identifier'
        },
        date_range: {
          type: 'object',
          description: 'Date range to search for available slots',
          properties: {
            start: {
              type: 'string',
              description: 'Start date in ISO 8601 format (YYYY-MM-DD)'
            },
            end: {
              type: 'string',
              description: 'End date in ISO 8601 format (YYYY-MM-DD)'
            }
          },
          required: ['start', 'end']
        }
      },
      required: ['provider_id', 'date_range']
    }
  },
  {
    name: 'get_upcoming_appointments',
    description: `Get the next upcoming appointments for a patient.
    Returns a sorted list of the patient's nearest scheduled appointments.
    HIPAA: This tool accesses PHI. All access is logged for audit compliance.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        patient_id: {
          type: 'string',
          description: 'The unique patient identifier'
        },
        count: {
          type: 'number',
          description: 'Number of upcoming appointments to return (1-20, default: 5)',
          minimum: 1,
          maximum: 20,
          default: 5
        }
      },
      required: ['patient_id']
    }
  }
];
