import axios, { AxiosInstance } from "axios";

/**
 * Vendor Performance/Quality Connector
 * Tracks vendor performance metrics, scorecards, and quality data
 */

export interface PerformanceConfig {
  apiUrl?: string;
  apiKey?: string;
}

export interface VendorScorecard {
  vendorId: string;
  vendorName: string;
  overallScore: number;
  qualityScore: number;
  deliveryScore: number;
  priceScore: number;
  responsiveness: number;
  compliance: number;
  trend: "improving" | "stable" | "declining";
  lastUpdated: string;
  evaluationPeriod: string;
}

export interface PerformanceMetric {
  metricId: string;
  vendorId: string;
  category: "quality" | "delivery" | "price" | "service" | "compliance";
  name: string;
  value: number;
  target: number;
  unit: string;
  period: string;
  status: "exceeds" | "meets" | "below";
}

export interface QualityIncident {
  id: string;
  vendorId: string;
  vendorName: string;
  incidentDate: string;
  severity: "critical" | "major" | "minor";
  category: string;
  description: string;
  status: "open" | "investigating" | "resolved" | "closed";
  resolution?: string;
  resolvedDate?: string;
  impactCost?: number;
}

export interface DeliveryPerformance {
  vendorId: string;
  vendorName: string;
  totalOrders: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimePercentage: number;
  averageLeadTime: number;
  targetLeadTime: number;
  period: string;
}

export interface UnderperformingVendor {
  vendor: {
    id: string;
    name: string;
  };
  scorecard: VendorScorecard;
  issues: string[];
  recommendedActions: string[];
}

export class PerformanceConnector {
  private config: PerformanceConfig;
  private httpClient: AxiosInstance;

  constructor(config: PerformanceConfig) {
    this.config = config;
    this.httpClient = axios.create({
      timeout: 30000,
    });
  }

  async initialize(): Promise<void> {
    if (this.config.apiUrl && this.config.apiKey) {
      this.httpClient = axios.create({
        baseURL: this.config.apiUrl,
        timeout: 30000,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      console.log("Performance connector initialized with API");
    } else {
      console.log("Performance connector initialized with mock data");
    }
  }

  // Scorecard Methods
  async getVendorScorecard(vendorId: string): Promise<VendorScorecard | null> {
    if (this.config.apiUrl) {
      try {
        const response = await this.httpClient.get(`/vendors/${vendorId}/scorecard`);
        return response.data;
      } catch (error) {
        console.warn("Performance API unavailable, returning mock data");
      }
    }

    const scorecards = this.getMockScorecards();
    return scorecards.find((s) => s.vendorId === vendorId) || null;
  }

  async getAllScorecards(): Promise<VendorScorecard[]> {
    if (this.config.apiUrl) {
      try {
        const response = await this.httpClient.get("/scorecards");
        return response.data;
      } catch (error) {
        console.warn("Performance API unavailable, returning mock data");
      }
    }

    return this.getMockScorecards();
  }

  async getUnderperformingVendors(threshold: number = 70): Promise<UnderperformingVendor[]> {
    const scorecards = await this.getAllScorecards();
    const underperforming: UnderperformingVendor[] = [];

    for (const scorecard of scorecards) {
      if (scorecard.overallScore < threshold) {
        const issues: string[] = [];
        const recommendedActions: string[] = [];

        if (scorecard.qualityScore < threshold) {
          issues.push(`Quality score (${scorecard.qualityScore}) below threshold`);
          recommendedActions.push("Schedule quality improvement meeting");
          recommendedActions.push("Request corrective action plan");
        }

        if (scorecard.deliveryScore < threshold) {
          issues.push(`Delivery score (${scorecard.deliveryScore}) below threshold`);
          recommendedActions.push("Review delivery schedules and capacity");
          recommendedActions.push("Consider backup supplier");
        }

        if (scorecard.priceScore < threshold) {
          issues.push(`Price competitiveness score (${scorecard.priceScore}) below threshold`);
          recommendedActions.push("Initiate price renegotiation");
          recommendedActions.push("Benchmark against alternative suppliers");
        }

        if (scorecard.responsiveness < threshold) {
          issues.push(`Responsiveness score (${scorecard.responsiveness}) below threshold`);
          recommendedActions.push("Escalate to vendor management");
          recommendedActions.push("Document communication issues");
        }

        if (scorecard.compliance < threshold) {
          issues.push(`Compliance score (${scorecard.compliance}) below threshold`);
          recommendedActions.push("Conduct compliance audit");
          recommendedActions.push("Review contractual obligations");
        }

        underperforming.push({
          vendor: {
            id: scorecard.vendorId,
            name: scorecard.vendorName,
          },
          scorecard,
          issues,
          recommendedActions,
        });
      }
    }

    return underperforming.sort((a, b) => a.scorecard.overallScore - b.scorecard.overallScore);
  }

  // Performance Metrics Methods
  async getVendorMetrics(vendorId: string): Promise<PerformanceMetric[]> {
    if (this.config.apiUrl) {
      try {
        const response = await this.httpClient.get(`/vendors/${vendorId}/metrics`);
        return response.data;
      } catch (error) {
        console.warn("Performance API unavailable, returning mock data");
      }
    }

    return this.getMockMetrics().filter((m) => m.vendorId === vendorId);
  }

  // Quality Incident Methods
  async getVendorIncidents(vendorId: string): Promise<QualityIncident[]> {
    if (this.config.apiUrl) {
      try {
        const response = await this.httpClient.get(`/vendors/${vendorId}/incidents`);
        return response.data;
      } catch (error) {
        console.warn("Performance API unavailable, returning mock data");
      }
    }

    return this.getMockIncidents().filter((i) => i.vendorId === vendorId);
  }

  async getOpenIncidents(): Promise<QualityIncident[]> {
    const allIncidents = this.getMockIncidents();
    return allIncidents.filter((i) => i.status === "open" || i.status === "investigating");
  }

  // Delivery Performance Methods
  async getDeliveryPerformance(vendorId: string): Promise<DeliveryPerformance | null> {
    if (this.config.apiUrl) {
      try {
        const response = await this.httpClient.get(`/vendors/${vendorId}/delivery`);
        return response.data;
      } catch (error) {
        console.warn("Performance API unavailable, returning mock data");
      }
    }

    const deliveryData = this.getMockDeliveryPerformance();
    return deliveryData.find((d) => d.vendorId === vendorId) || null;
  }

  // Mock Data Methods
  private getMockScorecards(): VendorScorecard[] {
    const today = new Date();
    const currentQuarter = `Q${Math.ceil((today.getMonth() + 1) / 3)} ${today.getFullYear()}`;

    return [
      {
        vendorId: "VEND-001",
        vendorName: "Acme Corporation",
        overallScore: 85,
        qualityScore: 90,
        deliveryScore: 82,
        priceScore: 78,
        responsiveness: 88,
        compliance: 92,
        trend: "stable",
        lastUpdated: today.toISOString(),
        evaluationPeriod: currentQuarter,
      },
      {
        vendorId: "VEND-002",
        vendorName: "Global Tech Solutions",
        overallScore: 65,
        qualityScore: 75,
        deliveryScore: 55,
        priceScore: 70,
        responsiveness: 60,
        compliance: 68,
        trend: "declining",
        lastUpdated: today.toISOString(),
        evaluationPeriod: currentQuarter,
      },
      {
        vendorId: "VEND-003",
        vendorName: "Office Plus Supplies",
        overallScore: 92,
        qualityScore: 95,
        deliveryScore: 94,
        priceScore: 85,
        responsiveness: 90,
        compliance: 95,
        trend: "improving",
        lastUpdated: today.toISOString(),
        evaluationPeriod: currentQuarter,
      },
      {
        vendorId: "VEND-004",
        vendorName: "Logistics Pro Inc",
        overallScore: 78,
        qualityScore: 80,
        deliveryScore: 75,
        priceScore: 82,
        responsiveness: 76,
        compliance: 78,
        trend: "stable",
        lastUpdated: today.toISOString(),
        evaluationPeriod: currentQuarter,
      },
      {
        vendorId: "VEND-005",
        vendorName: "Clean & Green Services",
        overallScore: 58,
        qualityScore: 60,
        deliveryScore: 65,
        priceScore: 55,
        responsiveness: 50,
        compliance: 58,
        trend: "declining",
        lastUpdated: today.toISOString(),
        evaluationPeriod: currentQuarter,
      },
    ];
  }

  private getMockMetrics(): PerformanceMetric[] {
    const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;

    return [
      // VEND-001 Metrics
      {
        metricId: "MET-001",
        vendorId: "VEND-001",
        category: "quality",
        name: "Defect Rate",
        value: 0.5,
        target: 1.0,
        unit: "%",
        period: currentQuarter,
        status: "exceeds",
      },
      {
        metricId: "MET-002",
        vendorId: "VEND-001",
        category: "delivery",
        name: "On-Time Delivery",
        value: 94,
        target: 95,
        unit: "%",
        period: currentQuarter,
        status: "meets",
      },
      {
        metricId: "MET-003",
        vendorId: "VEND-001",
        category: "price",
        name: "Price Variance",
        value: 2.5,
        target: 3.0,
        unit: "%",
        period: currentQuarter,
        status: "meets",
      },
      // VEND-002 Metrics
      {
        metricId: "MET-004",
        vendorId: "VEND-002",
        category: "quality",
        name: "Service Uptime",
        value: 97.5,
        target: 99.9,
        unit: "%",
        period: currentQuarter,
        status: "below",
      },
      {
        metricId: "MET-005",
        vendorId: "VEND-002",
        category: "delivery",
        name: "Issue Resolution Time",
        value: 48,
        target: 24,
        unit: "hours",
        period: currentQuarter,
        status: "below",
      },
      {
        metricId: "MET-006",
        vendorId: "VEND-002",
        category: "service",
        name: "Response Time",
        value: 4,
        target: 2,
        unit: "hours",
        period: currentQuarter,
        status: "below",
      },
    ];
  }

  private getMockIncidents(): QualityIncident[] {
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return [
      {
        id: "INC-001",
        vendorId: "VEND-002",
        vendorName: "Global Tech Solutions",
        incidentDate: oneWeekAgo.toISOString().split("T")[0],
        severity: "major",
        category: "Service Outage",
        description: "Cloud infrastructure experienced 4-hour unplanned downtime",
        status: "investigating",
        impactCost: 15000,
      },
      {
        id: "INC-002",
        vendorId: "VEND-001",
        vendorName: "Acme Corporation",
        incidentDate: twoWeeksAgo.toISOString().split("T")[0],
        severity: "minor",
        category: "Quality Defect",
        description: "Batch of components had minor cosmetic defects",
        status: "resolved",
        resolution: "Vendor provided replacement batch at no cost",
        resolvedDate: oneWeekAgo.toISOString().split("T")[0],
        impactCost: 2500,
      },
      {
        id: "INC-003",
        vendorId: "VEND-002",
        vendorName: "Global Tech Solutions",
        incidentDate: oneMonthAgo.toISOString().split("T")[0],
        severity: "critical",
        category: "Security",
        description: "Security vulnerability discovered in provided software",
        status: "closed",
        resolution: "Patch applied, security audit completed",
        resolvedDate: twoWeeksAgo.toISOString().split("T")[0],
        impactCost: 50000,
      },
      {
        id: "INC-004",
        vendorId: "VEND-004",
        vendorName: "Logistics Pro Inc",
        incidentDate: oneWeekAgo.toISOString().split("T")[0],
        severity: "minor",
        category: "Late Delivery",
        description: "Shipment delayed by 2 days due to carrier issues",
        status: "open",
        impactCost: 1000,
      },
    ];
  }

  private getMockDeliveryPerformance(): DeliveryPerformance[] {
    const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;

    return [
      {
        vendorId: "VEND-001",
        vendorName: "Acme Corporation",
        totalOrders: 150,
        onTimeDeliveries: 138,
        lateDeliveries: 12,
        onTimePercentage: 92,
        averageLeadTime: 7,
        targetLeadTime: 7,
        period: currentQuarter,
      },
      {
        vendorId: "VEND-002",
        vendorName: "Global Tech Solutions",
        totalOrders: 25,
        onTimeDeliveries: 18,
        lateDeliveries: 7,
        onTimePercentage: 72,
        averageLeadTime: 5,
        targetLeadTime: 3,
        period: currentQuarter,
      },
      {
        vendorId: "VEND-003",
        vendorName: "Office Plus Supplies",
        totalOrders: 75,
        onTimeDeliveries: 74,
        lateDeliveries: 1,
        onTimePercentage: 98.7,
        averageLeadTime: 2,
        targetLeadTime: 3,
        period: currentQuarter,
      },
      {
        vendorId: "VEND-004",
        vendorName: "Logistics Pro Inc",
        totalOrders: 200,
        onTimeDeliveries: 170,
        lateDeliveries: 30,
        onTimePercentage: 85,
        averageLeadTime: 4,
        targetLeadTime: 3,
        period: currentQuarter,
      },
    ];
  }
}

let performanceConnector: PerformanceConnector | null = null;

export function initializePerformanceConnector(): PerformanceConnector {
  if (!performanceConnector) {
    const config: PerformanceConfig = {
      apiUrl: process.env.PERFORMANCE_API_URL,
      apiKey: process.env.PERFORMANCE_API_KEY,
    };

    performanceConnector = new PerformanceConnector(config);
    performanceConnector.initialize().catch(console.error);
    console.log("Performance Connector initialized");
  }

  return performanceConnector;
}

export function getPerformanceConnector(): PerformanceConnector {
  if (!performanceConnector) {
    return initializePerformanceConnector();
  }
  return performanceConnector;
}
