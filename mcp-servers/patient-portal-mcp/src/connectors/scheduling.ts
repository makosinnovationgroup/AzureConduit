/**
 * Appointment Scheduling Connector
 *
 * Handles appointment management through EHR systems or dedicated scheduling APIs.
 *
 * HIPAA COMPLIANCE NOTES:
 * - Appointment information is considered PHI
 * - All access and modifications must be logged
 * - Patient identity verification required for booking operations
 * - Minimum necessary principle: only expose needed appointment details
 */

import { logAuditEvent, AuditCategory } from '../middleware/audit';
import { getEHRConnector } from './ehr';

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  // Appointment details
  start: string; // ISO 8601 datetime
  end: string;
  duration: number; // minutes
  status: AppointmentStatus;
  type: string;
  reason?: string;
  // Location
  location?: {
    id: string;
    name: string;
    address?: string;
  };
  // Instructions for patient
  instructions?: string;
  // Telehealth info if applicable
  telehealth?: {
    enabled: boolean;
    url?: string;
  };
}

export type AppointmentStatus =
  | 'proposed'
  | 'pending'
  | 'booked'
  | 'arrived'
  | 'fulfilled'
  | 'cancelled'
  | 'noshow';

export interface AppointmentSlot {
  id: string;
  providerId: string;
  providerName: string;
  start: string;
  end: string;
  duration: number;
  status: 'free' | 'busy';
  appointmentType?: string;
  location?: {
    id: string;
    name: string;
  };
}

export interface DateRange {
  start: string; // ISO 8601 date
  end: string;
}

export interface SchedulingConfig {
  // Use EHR's native scheduling or external system
  useEHRScheduling: boolean;
  // External scheduling system URL (if not using EHR)
  schedulingApiUrl?: string;
  schedulingApiKey?: string;
  // Default appointment duration in minutes
  defaultDuration: number;
  // How far in advance can appointments be booked (days)
  maxAdvanceBookingDays: number;
  // Minimum notice for cancellation (hours)
  minCancellationNotice: number;
}

class SchedulingConnector {
  private config: SchedulingConfig;

  constructor() {
    this.config = {
      useEHRScheduling: process.env.USE_EHR_SCHEDULING === 'true',
      schedulingApiUrl: process.env.SCHEDULING_API_URL,
      schedulingApiKey: process.env.SCHEDULING_API_KEY,
      defaultDuration: parseInt(process.env.DEFAULT_APPOINTMENT_DURATION || '30', 10),
      maxAdvanceBookingDays: parseInt(process.env.MAX_ADVANCE_BOOKING_DAYS || '90', 10),
      minCancellationNotice: parseInt(process.env.MIN_CANCELLATION_NOTICE_HOURS || '24', 10)
    };
  }

  /**
   * Get all appointments for a patient
   * HIPAA: Access logged, returns only appointments for authorized patient
   */
  async getPatientAppointments(patientId: string, dateRange?: DateRange): Promise<Appointment[]> {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'scheduling_connector',
        resourceType: 'APPOINTMENT' as AuditCategory,
        patientId,
        parameters: { dateRange }
      },
      'SUCCESS',
      'Fetching patient appointments'
    );

    // In production, this would query the EHR or scheduling system
    // Simulated response for structure demonstration
    const appointments: Appointment[] = [
      {
        id: 'apt-001',
        patientId,
        providerId: 'prov-001',
        providerName: 'Dr. Smith',
        start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
        duration: 30,
        status: 'booked',
        type: 'Follow-up Visit',
        location: {
          id: 'loc-001',
          name: 'Main Clinic',
          address: '123 Medical Center Dr'
        }
      }
    ];

    // Filter by date range if provided
    if (dateRange) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      return appointments.filter((apt) => {
        const aptDate = new Date(apt.start);
        return aptDate >= startDate && aptDate <= endDate;
      });
    }

    return appointments;
  }

  /**
   * Get a specific appointment by ID
   * HIPAA: Verify patient authorization before returning details
   */
  async getAppointment(appointmentId: string, patientId?: string): Promise<Appointment | null> {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'scheduling_connector',
        resourceType: 'APPOINTMENT' as AuditCategory,
        resourceId: appointmentId,
        patientId,
        parameters: { appointmentId }
      },
      'SUCCESS',
      'Fetching appointment details'
    );

    // In production, fetch from EHR/scheduling system
    // Include patient authorization check
    const appointment: Appointment = {
      id: appointmentId,
      patientId: patientId || 'unknown',
      providerId: 'prov-001',
      providerName: 'Dr. Smith',
      start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      duration: 30,
      status: 'booked',
      type: 'Follow-up Visit',
      reason: 'Annual checkup',
      location: {
        id: 'loc-001',
        name: 'Main Clinic',
        address: '123 Medical Center Dr'
      },
      instructions: 'Please arrive 15 minutes early. Bring your insurance card.',
      telehealth: {
        enabled: false
      }
    };

    return appointment;
  }

  /**
   * Get available appointment slots for a provider
   * Note: Available slots are not PHI, but access should still be logged
   */
  async getAvailableSlots(providerId: string, dateRange: DateRange): Promise<AppointmentSlot[]> {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'scheduling_connector',
        resourceType: 'APPOINTMENT' as AuditCategory,
        parameters: { providerId, dateRange }
      },
      'SUCCESS',
      'Fetching available slots'
    );

    // In production, query the scheduling system for provider availability
    // This would integrate with EHR's Schedule/Slot FHIR resources
    const slots: AppointmentSlot[] = [];

    // Generate sample slots for demonstration
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      // Generate slots for 9 AM to 5 PM
      for (let hour = 9; hour < 17; hour++) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);

        // Randomly mark some slots as busy (for demo)
        const isFree = Math.random() > 0.3;

        slots.push({
          id: `slot-${date.toISOString().split('T')[0]}-${hour}`,
          providerId,
          providerName: 'Dr. Smith',
          start: slotStart.toISOString(),
          end: new Date(slotStart.getTime() + 30 * 60 * 1000).toISOString(),
          duration: 30,
          status: isFree ? 'free' : 'busy',
          appointmentType: 'Office Visit',
          location: {
            id: 'loc-001',
            name: 'Main Clinic'
          }
        });
      }
    }

    // Only return free slots
    return slots.filter((slot) => slot.status === 'free');
  }

  /**
   * Get upcoming appointments for a patient (next N appointments)
   */
  async getUpcomingAppointments(patientId: string, count: number = 5): Promise<Appointment[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 365); // Look ahead 1 year

    const appointments = await this.getPatientAppointments(patientId, {
      start: now.toISOString(),
      end: futureDate.toISOString()
    });

    // Sort by start date and return requested count
    return appointments
      .filter((apt) => apt.status === 'booked' || apt.status === 'pending')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, count);
  }

  /**
   * Get the next single upcoming appointment for quick access
   */
  async getNextAppointment(patientId: string): Promise<Appointment | null> {
    const upcoming = await this.getUpcomingAppointments(patientId, 1);
    return upcoming.length > 0 ? upcoming[0] : null;
  }
}

// Singleton instance
let schedulingConnector: SchedulingConnector | null = null;

export function getSchedulingConnector(): SchedulingConnector {
  if (!schedulingConnector) {
    schedulingConnector = new SchedulingConnector();
  }
  return schedulingConnector;
}

export function resetSchedulingConnector(): void {
  schedulingConnector = null;
}

export default { getSchedulingConnector, resetSchedulingConnector };
