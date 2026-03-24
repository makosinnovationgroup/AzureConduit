/**
 * Billing Tools
 *
 * MCP tools for patient billing, claims, and payment information.
 *
 * HIPAA COMPLIANCE REQUIREMENTS:
 * - Billing information linked to patient identity is PHI
 * - Claims data includes diagnoses and procedures (sensitive PHI)
 * - All access must be logged with audit trail
 *
 * PCI DSS NOTE:
 * - Payment card data must be handled separately from PHI
 * - Only display last 4 digits of payment methods
 * - Never store or return full card numbers
 */

import { z } from 'zod';
import {
  getBillingConnector,
  PatientBalance,
  InsuranceClaim,
  Payment
} from '../connectors/billing';
import { logAuditEvent } from '../middleware/audit';

// ============================================================================
// Schema Definitions
// ============================================================================

export const getPatientBalanceSchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier')
});

export const getRecentClaimsSchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Maximum number of claims to return (1-50, default: 10)'),
  status: z
    .enum(['submitted', 'pending', 'in_review', 'approved', 'denied', 'partially_approved', 'paid', 'appealed'])
    .optional()
    .describe('Optional: filter by claim status')
});

export const getPaymentHistorySchema = z.object({
  patient_id: z.string().min(1).describe('The unique patient identifier'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .describe('Maximum number of payments to return (1-100, default: 10)')
});

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Get patient's outstanding balance
 *
 * HIPAA NOTE: Balance information linked to patient identity is PHI.
 * Includes current and past-due amounts, payment plan status.
 */
export async function getPatientBalance(
  params: z.infer<typeof getPatientBalanceSchema>
): Promise<{
  balance: PatientBalance;
  hasPaymentPlan: boolean;
  paymentRequired: boolean;
}> {
  const { patient_id } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_patient_balance',
      resourceType: 'BILLING',
      patientId: patient_id,
      purposeOfUse: 'PAYMENT' // Different purpose for billing
    },
    'SUCCESS',
    'Retrieving patient balance'
  );

  try {
    const billingConnector = getBillingConnector();
    const balance = await billingConnector.getPatientBalance(patient_id);

    // Log successful retrieval (amounts logged for audit, not PHI content)
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_patient_balance',
        resourceType: 'BILLING',
        patientId: patient_id,
        parameters: {
          hasBalance: balance.totalBalance > 0,
          hasPastDue: balance.pastDueBalance > 0
        }
      },
      'SUCCESS',
      'Balance retrieved successfully'
    );

    return {
      balance,
      hasPaymentPlan: balance.paymentPlan?.active || false,
      paymentRequired: balance.pastDueBalance > 0
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_patient_balance',
        resourceType: 'BILLING',
        patientId: patient_id
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Get recent insurance claims for a patient
 *
 * HIPAA NOTE: Claims contain highly sensitive PHI including:
 * - Diagnoses (ICD codes)
 * - Procedures (CPT/HCPCS codes)
 * - Treatment dates and providers
 * - Insurance information
 *
 * Access to claims data should be restricted to authorized users.
 */
export async function getRecentClaims(
  params: z.infer<typeof getRecentClaimsSchema>
): Promise<{
  claims: InsuranceClaim[];
  total: number;
  pendingCount: number;
  deniedCount: number;
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalPatientResponsibility: number;
    currency: string;
  };
}> {
  const { patient_id, limit = 10, status } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_recent_claims',
      resourceType: 'BILLING',
      patientId: patient_id,
      parameters: { limit, status },
      purposeOfUse: 'PAYMENT'
    },
    'SUCCESS',
    'Retrieving patient claims'
  );

  try {
    const billingConnector = getBillingConnector();
    const claims = await billingConnector.getRecentClaims(patient_id, limit, status);

    // Calculate summary totals
    const summary = claims.reduce(
      (acc, claim) => ({
        totalBilled: acc.totalBilled + claim.billedAmount,
        totalPaid: acc.totalPaid + (claim.paidAmount || 0),
        totalPatientResponsibility: acc.totalPatientResponsibility + (claim.patientResponsibility || 0),
        currency: claim.currency
      }),
      { totalBilled: 0, totalPaid: 0, totalPatientResponsibility: 0, currency: 'USD' }
    );

    const pendingCount = claims.filter(
      (c) => c.status === 'pending' || c.status === 'submitted' || c.status === 'in_review'
    ).length;
    const deniedCount = claims.filter((c) => c.status === 'denied').length;

    // Log successful retrieval
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_recent_claims',
        resourceType: 'BILLING',
        patientId: patient_id,
        parameters: {
          claimCount: claims.length,
          pendingCount,
          deniedCount
        }
      },
      'SUCCESS',
      `Retrieved ${claims.length} claims`
    );

    return {
      claims,
      total: claims.length,
      pendingCount,
      deniedCount,
      summary
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_recent_claims',
        resourceType: 'BILLING',
        patientId: patient_id
      },
      'FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}

/**
 * Get payment history for a patient
 *
 * HIPAA NOTE: Payment records are linked to patient identity.
 *
 * PCI DSS NOTE:
 * - Only last 4 digits of payment methods are returned
 * - Full card numbers are never stored or transmitted
 * - Payment processing is handled by PCI-compliant systems
 */
export async function getPaymentHistory(
  params: z.infer<typeof getPaymentHistorySchema>
): Promise<{
  payments: Payment[];
  total: number;
  totalPaid: number;
  mostRecentPayment: Payment | null;
  currency: string;
}> {
  const { patient_id, limit = 10 } = params;

  // Log the PHI access attempt
  logAuditEvent(
    'PHI_ACCESS',
    {
      toolName: 'get_payment_history',
      resourceType: 'BILLING',
      patientId: patient_id,
      parameters: { limit },
      purposeOfUse: 'PAYMENT'
    },
    'SUCCESS',
    'Retrieving payment history'
  );

  try {
    const billingConnector = getBillingConnector();
    const payments = await billingConnector.getPaymentHistory(patient_id, limit);

    // Calculate total paid (only completed payments)
    const completedPayments = payments.filter((p) => p.status === 'completed');
    const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);

    // Get most recent payment
    const mostRecentPayment = payments.length > 0 ? payments[0] : null;

    // Log successful retrieval
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_payment_history',
        resourceType: 'BILLING',
        patientId: patient_id,
        parameters: {
          paymentCount: payments.length,
          completedCount: completedPayments.length
        }
      },
      'SUCCESS',
      `Retrieved ${payments.length} payments`
    );

    return {
      payments,
      total: payments.length,
      totalPaid,
      mostRecentPayment,
      currency: payments[0]?.currency || 'USD'
    };
  } catch (error) {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'get_payment_history',
        resourceType: 'BILLING',
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
    name: 'get_patient_balance',
    description: `Get patient's outstanding balance including current and past-due amounts.
    Also indicates if patient has an active payment plan.
    HIPAA: Billing data linked to patient is PHI. All access is logged for audit compliance.`,
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
    name: 'get_recent_claims',
    description: `Get recent insurance claims for a patient including status, amounts, and line item details.
    Can filter by claim status. Includes summary of total billed, paid, and patient responsibility.
    HIPAA: Claims contain diagnoses and procedures - highly sensitive PHI. All access is logged.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        patient_id: {
          type: 'string',
          description: 'The unique patient identifier'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of claims to return (1-50, default: 10)',
          minimum: 1,
          maximum: 50,
          default: 10
        },
        status: {
          type: 'string',
          enum: ['submitted', 'pending', 'in_review', 'approved', 'denied', 'partially_approved', 'paid', 'appealed'],
          description: 'Optional: filter by claim status'
        }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'get_payment_history',
    description: `Get payment history for a patient including payment method (last 4 digits only), amounts, and status.
    Returns total amount paid and most recent payment.
    HIPAA: Payment data linked to patient is PHI. PCI DSS: Only masked payment methods returned.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        patient_id: {
          type: 'string',
          description: 'The unique patient identifier'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of payments to return (1-100, default: 10)',
          minimum: 1,
          maximum: 100,
          default: 10
        }
      },
      required: ['patient_id']
    }
  }
];
