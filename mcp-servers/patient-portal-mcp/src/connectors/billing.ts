/**
 * Patient Billing Connector
 *
 * Handles patient billing information, claims, and payment history.
 *
 * HIPAA COMPLIANCE NOTES:
 * - Billing information is considered PHI when linked to patient identity
 * - All access must be logged
 * - Payment card data (PCI DSS) should be handled separately
 * - Financial data requires additional access controls
 */

import { logAuditEvent, AuditCategory } from '../middleware/audit';

export interface PatientBalance {
  patientId: string;
  totalBalance: number;
  currentBalance: number;
  pastDueBalance: number;
  pastDueAmount30Days: number;
  pastDueAmount60Days: number;
  pastDueAmount90Plus: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  // Payment plan info if applicable
  paymentPlan?: {
    active: boolean;
    monthlyAmount: number;
    remainingBalance: number;
    nextPaymentDate: string;
  };
  currency: string;
}

export interface InsuranceClaim {
  id: string;
  patientId: string;
  // Claim details
  claimNumber: string;
  dateOfService: string;
  submittedDate: string;
  status: ClaimStatus;
  // Provider and facility
  providerName: string;
  facilityName: string;
  // Financial details
  billedAmount: number;
  allowedAmount?: number;
  paidAmount?: number;
  patientResponsibility?: number;
  adjustmentAmount?: number;
  // Insurance info
  payerName: string;
  payerId: string;
  // Line items (procedures/services)
  lineItems: ClaimLineItem[];
  // EOB info
  explanationOfBenefits?: string;
  currency: string;
}

export type ClaimStatus =
  | 'submitted'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'denied'
  | 'partially_approved'
  | 'paid'
  | 'appealed';

export interface ClaimLineItem {
  lineNumber: number;
  serviceCode: string; // CPT/HCPCS code
  serviceDescription: string;
  quantity: number;
  billedAmount: number;
  allowedAmount?: number;
  paidAmount?: number;
  denialReason?: string;
}

export interface Payment {
  id: string;
  patientId: string;
  paymentDate: string;
  amount: number;
  // Payment method (masked for security)
  paymentMethod: PaymentMethod;
  paymentMethodLast4?: string;
  // What the payment was for
  appliedTo: PaymentApplication[];
  // Status
  status: PaymentStatus;
  confirmationNumber?: string;
  // Refund info if applicable
  refundedAmount?: number;
  refundDate?: string;
  currency: string;
}

export type PaymentMethod = 'credit_card' | 'debit_card' | 'bank_transfer' | 'check' | 'cash' | 'payment_plan';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';

export interface PaymentApplication {
  claimId?: string;
  invoiceId?: string;
  dateOfService?: string;
  description: string;
  amount: number;
}

export interface BillingConfig {
  billingSystemUrl?: string;
  billingApiKey?: string;
  // Use EHR's billing module or external system
  useEHRBilling: boolean;
  // Currency settings
  defaultCurrency: string;
}

class BillingConnector {
  private config: BillingConfig;

  constructor() {
    this.config = {
      billingSystemUrl: process.env.BILLING_SYSTEM_URL,
      billingApiKey: process.env.BILLING_API_KEY,
      useEHRBilling: process.env.USE_EHR_BILLING === 'true',
      defaultCurrency: process.env.BILLING_CURRENCY || 'USD'
    };
  }

  /**
   * Get patient's current balance
   * HIPAA: Financial information linked to patient is PHI
   */
  async getPatientBalance(patientId: string): Promise<PatientBalance> {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'billing_connector',
        resourceType: 'BILLING' as AuditCategory,
        patientId,
        parameters: { action: 'get_balance' }
      },
      'SUCCESS',
      'Fetching patient balance'
    );

    // In production, query the billing system
    // This is a simulated response structure
    const balance: PatientBalance = {
      patientId,
      totalBalance: 450.0,
      currentBalance: 150.0,
      pastDueBalance: 300.0,
      pastDueAmount30Days: 200.0,
      pastDueAmount60Days: 100.0,
      pastDueAmount90Plus: 0,
      lastPaymentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      lastPaymentAmount: 75.0,
      paymentPlan: undefined,
      currency: this.config.defaultCurrency
    };

    return balance;
  }

  /**
   * Get recent insurance claims for a patient
   * HIPAA: Claims contain detailed PHI including diagnoses and procedures
   */
  async getRecentClaims(
    patientId: string,
    limit: number = 10,
    status?: ClaimStatus
  ): Promise<InsuranceClaim[]> {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'billing_connector',
        resourceType: 'BILLING' as AuditCategory,
        patientId,
        parameters: { action: 'get_claims', limit, status }
      },
      'SUCCESS',
      'Fetching patient claims'
    );

    // In production, query the billing/claims system
    const claims: InsuranceClaim[] = [
      {
        id: 'claim-001',
        patientId,
        claimNumber: 'CLM-2024-001234',
        dateOfService: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        submittedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        providerName: 'Dr. Smith',
        facilityName: 'Main Clinic',
        billedAmount: 350.0,
        allowedAmount: 280.0,
        paidAmount: undefined,
        patientResponsibility: undefined,
        payerName: 'Blue Cross Blue Shield',
        payerId: 'BCBS-001',
        lineItems: [
          {
            lineNumber: 1,
            serviceCode: '99213',
            serviceDescription: 'Office Visit - Established Patient',
            quantity: 1,
            billedAmount: 200.0,
            allowedAmount: 150.0
          },
          {
            lineNumber: 2,
            serviceCode: '36415',
            serviceDescription: 'Blood Draw - Routine',
            quantity: 1,
            billedAmount: 50.0,
            allowedAmount: 30.0
          },
          {
            lineNumber: 3,
            serviceCode: '80053',
            serviceDescription: 'Comprehensive Metabolic Panel',
            quantity: 1,
            billedAmount: 100.0,
            allowedAmount: 100.0
          }
        ],
        currency: this.config.defaultCurrency
      },
      {
        id: 'claim-002',
        patientId,
        claimNumber: 'CLM-2024-001100',
        dateOfService: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        submittedDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'paid',
        providerName: 'Dr. Johnson',
        facilityName: 'Specialty Center',
        billedAmount: 500.0,
        allowedAmount: 400.0,
        paidAmount: 320.0,
        patientResponsibility: 80.0,
        adjustmentAmount: 100.0,
        payerName: 'Blue Cross Blue Shield',
        payerId: 'BCBS-001',
        lineItems: [
          {
            lineNumber: 1,
            serviceCode: '99214',
            serviceDescription: 'Office Visit - Established Patient (Extended)',
            quantity: 1,
            billedAmount: 300.0,
            allowedAmount: 250.0,
            paidAmount: 200.0
          },
          {
            lineNumber: 2,
            serviceCode: '93000',
            serviceDescription: 'Electrocardiogram (ECG)',
            quantity: 1,
            billedAmount: 200.0,
            allowedAmount: 150.0,
            paidAmount: 120.0
          }
        ],
        explanationOfBenefits: 'Claim processed per plan benefits. Patient responsibility includes 20% coinsurance.',
        currency: this.config.defaultCurrency
      }
    ];

    // Filter by status if specified
    if (status) {
      return claims.filter((c) => c.status === status).slice(0, limit);
    }

    return claims.slice(0, limit);
  }

  /**
   * Get payment history for a patient
   * HIPAA + PCI: Payment details require careful handling
   * Note: Full card numbers should NEVER be stored or returned
   */
  async getPaymentHistory(patientId: string, limit: number = 10): Promise<Payment[]> {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'billing_connector',
        resourceType: 'BILLING' as AuditCategory,
        patientId,
        parameters: { action: 'get_payments', limit }
      },
      'SUCCESS',
      'Fetching payment history'
    );

    // In production, query the payment/billing system
    const payments: Payment[] = [
      {
        id: 'pmt-001',
        patientId,
        paymentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 75.0,
        paymentMethod: 'credit_card',
        paymentMethodLast4: '4242',
        appliedTo: [
          {
            claimId: 'claim-002',
            dateOfService: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            description: 'Patient responsibility for office visit',
            amount: 75.0
          }
        ],
        status: 'completed',
        confirmationNumber: 'CONF-20240115-001',
        currency: this.config.defaultCurrency
      },
      {
        id: 'pmt-002',
        patientId,
        paymentDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 150.0,
        paymentMethod: 'bank_transfer',
        paymentMethodLast4: '6789',
        appliedTo: [
          {
            invoiceId: 'inv-2023-500',
            description: 'Outstanding balance payment',
            amount: 150.0
          }
        ],
        status: 'completed',
        confirmationNumber: 'CONF-20231215-002',
        currency: this.config.defaultCurrency
      },
      {
        id: 'pmt-003',
        patientId,
        paymentDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amount: 50.0,
        paymentMethod: 'credit_card',
        paymentMethodLast4: '1234',
        appliedTo: [
          {
            description: 'Copay for lab services',
            amount: 50.0
          }
        ],
        status: 'completed',
        confirmationNumber: 'CONF-20231115-003',
        currency: this.config.defaultCurrency
      }
    ];

    return payments.slice(0, limit);
  }

  /**
   * Get a specific claim by ID
   */
  async getClaim(claimId: string, patientId: string): Promise<InsuranceClaim | null> {
    logAuditEvent(
      'PHI_ACCESS',
      {
        toolName: 'billing_connector',
        resourceType: 'BILLING' as AuditCategory,
        patientId,
        resourceId: claimId,
        parameters: { action: 'get_claim' }
      },
      'SUCCESS',
      'Fetching claim details'
    );

    // In production, fetch specific claim and verify patient authorization
    const claims = await this.getRecentClaims(patientId, 100);
    return claims.find((c) => c.id === claimId) || null;
  }
}

// Singleton instance
let billingConnector: BillingConnector | null = null;

export function getBillingConnector(): BillingConnector {
  if (!billingConnector) {
    billingConnector = new BillingConnector();
  }
  return billingConnector;
}

export function resetBillingConnector(): void {
  billingConnector = null;
}

export default { getBillingConnector, resetBillingConnector };
