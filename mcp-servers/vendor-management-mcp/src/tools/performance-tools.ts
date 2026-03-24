import { z } from "zod";
import {
  getPerformanceConnector,
  VendorScorecard,
  PerformanceMetric,
  QualityIncident,
  DeliveryPerformance,
  UnderperformingVendor,
} from "../connectors/performance.js";

// Schema definitions
export const GetVendorScorecardSchema = z.object({
  vendor_id: z.string().min(1).describe("The unique vendor identifier"),
});

export const GetUnderperformingVendorsSchema = z.object({
  threshold: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(70)
    .describe("Performance score threshold (default: 70). Vendors scoring below this are included."),
});

// Response types
export interface VendorScorecardResponse {
  vendorId: string;
  found: boolean;
  scorecard: VendorScorecard | null;
  metrics: PerformanceMetric[];
  incidents: {
    total: number;
    open: number;
    recentIncidents: QualityIncident[];
  };
  delivery: DeliveryPerformance | null;
  summary?: {
    performanceLevel: "excellent" | "good" | "satisfactory" | "needs_improvement" | "poor";
    strengths: string[];
    areasForImprovement: string[];
  };
}

export interface UnderperformingVendorsResponse {
  threshold: number;
  totalVendors: number;
  underperformingCount: number;
  vendors: UnderperformingVendor[];
  summary: {
    criticalCount: number;
    warningCount: number;
    byTrend: {
      declining: number;
      stable: number;
      improving: number;
    };
  };
}

// Helper function to determine performance level
function getPerformanceLevel(
  score: number
): "excellent" | "good" | "satisfactory" | "needs_improvement" | "poor" {
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 70) return "satisfactory";
  if (score >= 60) return "needs_improvement";
  return "poor";
}

// Helper function to identify strengths and areas for improvement
function analyzeScorecard(scorecard: VendorScorecard): {
  strengths: string[];
  areasForImprovement: string[];
} {
  const strengths: string[] = [];
  const areasForImprovement: string[] = [];
  const threshold = 75;

  const categories = [
    { name: "Quality", score: scorecard.qualityScore },
    { name: "Delivery", score: scorecard.deliveryScore },
    { name: "Price competitiveness", score: scorecard.priceScore },
    { name: "Responsiveness", score: scorecard.responsiveness },
    { name: "Compliance", score: scorecard.compliance },
  ];

  for (const category of categories) {
    if (category.score >= 85) {
      strengths.push(`${category.name} (${category.score}%)`);
    } else if (category.score < threshold) {
      areasForImprovement.push(`${category.name} (${category.score}%)`);
    }
  }

  if (scorecard.trend === "improving") {
    strengths.push("Performance trending upward");
  } else if (scorecard.trend === "declining") {
    areasForImprovement.push("Performance trending downward");
  }

  return { strengths, areasForImprovement };
}

// Tool implementations
export async function getVendorScorecard(
  params: z.infer<typeof GetVendorScorecardSchema>
): Promise<VendorScorecardResponse> {
  const { vendor_id } = params;
  console.log(`Getting performance scorecard for vendor: ${vendor_id}`);

  const performanceConnector = getPerformanceConnector();

  const scorecard = await performanceConnector.getVendorScorecard(vendor_id);

  if (!scorecard) {
    return {
      vendorId: vendor_id,
      found: false,
      scorecard: null,
      metrics: [],
      incidents: {
        total: 0,
        open: 0,
        recentIncidents: [],
      },
      delivery: null,
    };
  }

  // Get additional performance data
  const metrics = await performanceConnector.getVendorMetrics(vendor_id);
  const incidents = await performanceConnector.getVendorIncidents(vendor_id);
  const delivery = await performanceConnector.getDeliveryPerformance(vendor_id);

  // Calculate incident summary
  const openIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating"
  );

  // Get recent incidents (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentIncidents = incidents
    .filter((i) => new Date(i.incidentDate) >= ninetyDaysAgo)
    .sort(
      (a, b) =>
        new Date(b.incidentDate).getTime() - new Date(a.incidentDate).getTime()
    );

  // Analyze scorecard for summary
  const { strengths, areasForImprovement } = analyzeScorecard(scorecard);

  return {
    vendorId: vendor_id,
    found: true,
    scorecard,
    metrics,
    incidents: {
      total: incidents.length,
      open: openIncidents.length,
      recentIncidents,
    },
    delivery,
    summary: {
      performanceLevel: getPerformanceLevel(scorecard.overallScore),
      strengths,
      areasForImprovement,
    },
  };
}

export async function getUnderperformingVendors(
  params: z.infer<typeof GetUnderperformingVendorsSchema>
): Promise<UnderperformingVendorsResponse> {
  const { threshold } = params;
  console.log(`Getting underperforming vendors with threshold: ${threshold}`);

  const performanceConnector = getPerformanceConnector();

  const allScorecards = await performanceConnector.getAllScorecards();
  const underperforming = await performanceConnector.getUnderperformingVendors(threshold);

  // Calculate summary statistics
  const criticalCount = underperforming.filter((v) => v.scorecard.overallScore < 50).length;
  const warningCount = underperforming.filter(
    (v) => v.scorecard.overallScore >= 50 && v.scorecard.overallScore < threshold
  ).length;

  const byTrend = {
    declining: underperforming.filter((v) => v.scorecard.trend === "declining").length,
    stable: underperforming.filter((v) => v.scorecard.trend === "stable").length,
    improving: underperforming.filter((v) => v.scorecard.trend === "improving").length,
  };

  return {
    threshold,
    totalVendors: allScorecards.length,
    underperformingCount: underperforming.length,
    vendors: underperforming,
    summary: {
      criticalCount,
      warningCount,
      byTrend,
    },
  };
}

// Tool definitions for MCP registration
export const performanceTools = [
  {
    name: "get_vendor_scorecard",
    description:
      "Get comprehensive vendor performance metrics including quality, delivery, price scores, incidents, and performance analysis",
    schema: GetVendorScorecardSchema,
    handler: getVendorScorecard,
  },
  {
    name: "get_underperforming_vendors",
    description:
      "Get all vendors performing below a specified threshold, with issues identified and recommended actions",
    schema: GetUnderperformingVendorsSchema,
    handler: getUnderperformingVendors,
  },
];
