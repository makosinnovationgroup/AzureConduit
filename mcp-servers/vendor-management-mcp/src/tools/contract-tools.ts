import { z } from "zod";
import {
  getContractConnector,
  Contract,
  ContractDetails,
  ExpiringContract,
} from "../connectors/contracts.js";

// Schema definitions
export const GetVendorContractsSchema = z.object({
  vendor_id: z.string().min(1).describe("The unique vendor identifier"),
});

export const GetExpiringContractsSchema = z.object({
  days: z
    .number()
    .min(1)
    .max(365)
    .default(90)
    .describe("Number of days to look ahead for expiring contracts (default: 90)"),
});

export const GetContractDetailsSchema = z.object({
  contract_id: z.string().min(1).describe("The unique contract identifier"),
});

// Response types
export interface VendorContractsResponse {
  vendorId: string;
  totalActiveContracts: number;
  totalContractValue: number;
  contracts: Contract[];
}

export interface ExpiringContractsResponse {
  lookAheadDays: number;
  totalExpiring: number;
  byRenewalAction: {
    autoRenew: number;
    requiresReview: number;
    mustNegotiate: number;
  };
  contracts: ExpiringContract[];
}

export interface ContractDetailsResponse {
  found: boolean;
  contract: ContractDetails | null;
  summary?: {
    daysUntilExpiry: number;
    isExpiringSoon: boolean;
    hasAmendments: boolean;
    totalAmendments: number;
    keyObligations: string[];
  };
}

// Tool implementations
export async function getVendorContracts(
  params: z.infer<typeof GetVendorContractsSchema>
): Promise<VendorContractsResponse> {
  const { vendor_id } = params;
  console.log(`Getting contracts for vendor: ${vendor_id}`);

  const contractConnector = getContractConnector();
  const contracts = await contractConnector.getVendorContracts(vendor_id);
  const totalContractValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);

  return {
    vendorId: vendor_id,
    totalActiveContracts: contracts.length,
    totalContractValue,
    contracts,
  };
}

export async function getExpiringContracts(
  params: z.infer<typeof GetExpiringContractsSchema>
): Promise<ExpiringContractsResponse> {
  const { days } = params;
  console.log(`Getting contracts expiring within ${days} days`);

  const contractConnector = getContractConnector();
  const expiringContracts = await contractConnector.getExpiringContracts(days);

  // Count by renewal action
  const byRenewalAction = {
    autoRenew: 0,
    requiresReview: 0,
    mustNegotiate: 0,
  };

  for (const ec of expiringContracts) {
    switch (ec.renewalAction) {
      case "auto_renew":
        byRenewalAction.autoRenew++;
        break;
      case "requires_review":
        byRenewalAction.requiresReview++;
        break;
      case "must_negotiate":
        byRenewalAction.mustNegotiate++;
        break;
    }
  }

  return {
    lookAheadDays: days,
    totalExpiring: expiringContracts.length,
    byRenewalAction,
    contracts: expiringContracts,
  };
}

export async function getContractDetails(
  params: z.infer<typeof GetContractDetailsSchema>
): Promise<ContractDetailsResponse> {
  const { contract_id } = params;
  console.log(`Getting contract details for: ${contract_id}`);

  const contractConnector = getContractConnector();
  const contract = await contractConnector.getContract(contract_id);

  if (!contract) {
    return {
      found: false,
      contract: null,
    };
  }

  // Calculate summary information
  const today = new Date();
  const endDate = new Date(contract.endDate);
  const daysUntilExpiry = Math.ceil(
    (endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Extract key obligations from terms
  const keyObligations: string[] = [];

  if (contract.terms.paymentTerms) {
    keyObligations.push(`Payment: ${contract.terms.paymentTerms}`);
  }
  if (contract.terms.deliveryTerms) {
    keyObligations.push(`Delivery: ${contract.terms.deliveryTerms}`);
  }
  if (contract.terms.warrantyTerms) {
    keyObligations.push(`Warranty: ${contract.terms.warrantyTerms}`);
  }
  if (contract.terms.insuranceRequirements) {
    keyObligations.push(`Insurance: ${contract.terms.insuranceRequirements}`);
  }
  if (contract.terms.confidentialityClause) {
    keyObligations.push("Confidentiality agreement in effect");
  }
  if (contract.terms.exclusivityClause) {
    keyObligations.push("Exclusivity clause in effect");
  }
  if (contract.terminationNoticeDays) {
    keyObligations.push(
      `Termination requires ${contract.terminationNoticeDays} days notice`
    );
  }

  return {
    found: true,
    contract,
    summary: {
      daysUntilExpiry,
      isExpiringSoon: daysUntilExpiry <= 90 && daysUntilExpiry > 0,
      hasAmendments: contract.amendments.length > 0,
      totalAmendments: contract.amendments.length,
      keyObligations,
    },
  };
}

// Tool definitions for MCP registration
export const contractTools = [
  {
    name: "get_vendor_contracts",
    description:
      "Get all active contracts for a specific vendor, including contract values and details",
    schema: GetVendorContractsSchema,
    handler: getVendorContracts,
  },
  {
    name: "get_expiring_contracts",
    description:
      "Get contracts expiring within a specified number of days, with renewal action recommendations",
    schema: GetExpiringContractsSchema,
    handler: getExpiringContracts,
  },
  {
    name: "get_contract_details",
    description:
      "Get detailed contract information including terms, obligations, signatories, and amendments",
    schema: GetContractDetailsSchema,
    handler: getContractDetails,
  },
];
