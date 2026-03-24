/**
 * Health Calculator Service
 *
 * This service calculates account health scores by aggregating data from
 * multiple systems (CRM, Finance, Support) and applying weighted scoring
 * algorithms to produce actionable health insights.
 */

import { CRMAccount, CRMActivity, CRMOpportunity } from "../connectors/crm";
import { CustomerBalance, RevenueData } from "../connectors/finance";
import { SupportMetrics, SupportTicket } from "../connectors/support";

// =============================================================================
// Types
// =============================================================================

export interface HealthScore {
  accountId: string;
  accountName: string;
  overallScore: number; // 0-100
  scores: {
    revenue: number; // 0-100
    payment: number; // 0-100
    support: number; // 0-100
    engagement: number; // 0-100
  };
  trend: "improving" | "stable" | "declining";
  riskLevel: "low" | "medium" | "high" | "critical";
  lastCalculated: string;
}

export interface HealthFactors {
  accountId: string;
  factors: HealthFactor[];
  recommendations: string[];
}

export interface HealthFactor {
  category: "revenue" | "payment" | "support" | "engagement";
  name: string;
  value: string | number;
  impact: "positive" | "neutral" | "negative";
  weight: number;
  contribution: number; // Contribution to overall score
  description: string;
}

export interface HealthInputData {
  // CRM data
  account?: CRMAccount;
  activities?: CRMActivity[];
  opportunities?: CRMOpportunity[];
  lastActivity?: CRMActivity | null;

  // Finance data
  balance?: CustomerBalance | null;
  revenueTrend?: RevenueData[];

  // Support data
  supportMetrics?: SupportMetrics;
  openTickets?: SupportTicket[];
  recentTickets?: SupportTicket[];
}

export interface HealthConfig {
  weights: {
    revenue: number;
    payment: number;
    support: number;
    engagement: number;
  };
  thresholds: {
    atRiskHealth: number;
    revenueDecline: number;
    supportTicketsWarning: number;
    paymentDaysOverdueWarning: number;
  };
}

// =============================================================================
// Health Calculator Class
// =============================================================================

export class HealthCalculator {
  private config: HealthConfig;

  constructor(config?: Partial<HealthConfig>) {
    this.config = {
      weights: {
        revenue: config?.weights?.revenue ?? 0.30,
        payment: config?.weights?.payment ?? 0.25,
        support: config?.weights?.support ?? 0.25,
        engagement: config?.weights?.engagement ?? 0.20,
      },
      thresholds: {
        atRiskHealth: config?.thresholds?.atRiskHealth ?? 60,
        revenueDecline: config?.thresholds?.revenueDecline ?? 0.15,
        supportTicketsWarning: config?.thresholds?.supportTicketsWarning ?? 5,
        paymentDaysOverdueWarning:
          config?.thresholds?.paymentDaysOverdueWarning ?? 30,
      },
    };

    // Normalize weights to sum to 1
    const totalWeight =
      this.config.weights.revenue +
      this.config.weights.payment +
      this.config.weights.support +
      this.config.weights.engagement;

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.warn(
        `Health weights sum to ${totalWeight}, normalizing to 1.0`
      );
      this.config.weights.revenue /= totalWeight;
      this.config.weights.payment /= totalWeight;
      this.config.weights.support /= totalWeight;
      this.config.weights.engagement /= totalWeight;
    }
  }

  /**
   * Calculate comprehensive health score from aggregated data
   */
  calculateHealthScore(
    accountId: string,
    accountName: string,
    data: HealthInputData
  ): HealthScore {
    const revenueScore = this.calculateRevenueScore(data);
    const paymentScore = this.calculatePaymentScore(data);
    const supportScore = this.calculateSupportScore(data);
    const engagementScore = this.calculateEngagementScore(data);

    const overallScore = Math.round(
      revenueScore * this.config.weights.revenue +
        paymentScore * this.config.weights.payment +
        supportScore * this.config.weights.support +
        engagementScore * this.config.weights.engagement
    );

    const trend = this.determineTrend(data, overallScore);
    const riskLevel = this.determineRiskLevel(overallScore, data);

    return {
      accountId,
      accountName,
      overallScore,
      scores: {
        revenue: revenueScore,
        payment: paymentScore,
        support: supportScore,
        engagement: engagementScore,
      },
      trend,
      riskLevel,
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Calculate revenue health score (0-100)
   * Based on: revenue trend, YoY growth, opportunity pipeline
   */
  private calculateRevenueScore(data: HealthInputData): number {
    let score = 70; // Base score

    // Revenue trend analysis
    if (data.revenueTrend && data.revenueTrend.length >= 2) {
      const recentMonths = data.revenueTrend.slice(-6);
      const olderMonths = data.revenueTrend.slice(-12, -6);

      const recentTotal = recentMonths.reduce(
        (sum, r) => sum + r.totalRevenue,
        0
      );
      const olderTotal = olderMonths.reduce(
        (sum, r) => sum + r.totalRevenue,
        0
      );

      if (olderTotal > 0) {
        const growthRate = (recentTotal - olderTotal) / olderTotal;

        if (growthRate > 0.2) score += 20; // Strong growth
        else if (growthRate > 0.1) score += 15; // Good growth
        else if (growthRate > 0) score += 10; // Slight growth
        else if (growthRate > -0.1) score -= 5; // Slight decline
        else if (growthRate > -0.2) score -= 15; // Moderate decline
        else score -= 25; // Significant decline
      }
    }

    // Opportunity pipeline
    if (data.opportunities) {
      const openOpps = data.opportunities.filter((o) => !o.isClosed);
      const totalPipelineValue = openOpps.reduce((sum, o) => sum + o.amount, 0);
      const highProbOpps = openOpps.filter((o) => o.probability >= 70);

      if (highProbOpps.length > 0) score += 10;
      if (totalPipelineValue > 50000) score += 5;
    }

    // Account revenue baseline
    if (data.account?.annualRevenue) {
      if (data.account.annualRevenue > 1000000) score += 5;
      else if (data.account.annualRevenue < 10000) score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate payment health score (0-100)
   * Based on: payment timeliness, outstanding balance, overdue amount
   */
  private calculatePaymentScore(data: HealthInputData): number {
    let score = 100; // Start with perfect score

    if (!data.balance) return 80; // No data, assume okay

    // Overdue balance penalty
    if (data.balance.overdueBalance > 0) {
      const overdueRatio =
        data.balance.overdueBalance / (data.balance.totalBalance || 1);

      if (overdueRatio > 0.5) score -= 40; // More than half overdue
      else if (overdueRatio > 0.25) score -= 25;
      else if (overdueRatio > 0.1) score -= 15;
      else score -= 10;
    }

    // Days overdue penalty
    if (data.balance.daysOverdue > 0) {
      if (data.balance.daysOverdue > 90) score -= 30;
      else if (data.balance.daysOverdue > 60) score -= 20;
      else if (data.balance.daysOverdue > 30) score -= 10;
      else score -= 5;
    }

    // Recent payment activity bonus
    if (data.balance.lastPaymentDate) {
      const daysSincePayment = Math.floor(
        (Date.now() - new Date(data.balance.lastPaymentDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSincePayment < 30) score += 5;
      else if (daysSincePayment > 90) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate support health score (0-100)
   * Based on: ticket volume, open tickets, resolution time, satisfaction
   */
  private calculateSupportScore(data: HealthInputData): number {
    let score = 85; // Base score - no tickets is good!

    if (!data.supportMetrics) return score;

    const metrics = data.supportMetrics;

    // Open ticket penalty
    if (metrics.openTickets > 10) score -= 25;
    else if (metrics.openTickets > 5) score -= 15;
    else if (metrics.openTickets > 2) score -= 10;
    else if (metrics.openTickets > 0) score -= 5;

    // High/urgent ticket penalty
    const criticalTickets =
      metrics.ticketsByPriority.urgent + metrics.ticketsByPriority.high;
    if (criticalTickets > 5) score -= 20;
    else if (criticalTickets > 2) score -= 10;
    else if (criticalTickets > 0) score -= 5;

    // Resolution time factor
    if (metrics.averageResolutionTimeHours > 72) score -= 15;
    else if (metrics.averageResolutionTimeHours > 48) score -= 10;
    else if (metrics.averageResolutionTimeHours > 24) score -= 5;
    else if (metrics.averageResolutionTimeHours < 8) score += 5;

    // Satisfaction score factor
    if (metrics.averageSatisfactionScore) {
      if (metrics.averageSatisfactionScore >= 4.5) score += 10;
      else if (metrics.averageSatisfactionScore >= 4) score += 5;
      else if (metrics.averageSatisfactionScore < 3) score -= 15;
      else if (metrics.averageSatisfactionScore < 3.5) score -= 10;
    }

    // Volume trend (check recent tickets)
    if (data.recentTickets && data.recentTickets.length > 0) {
      const recentWeek = data.recentTickets.filter((t) => {
        const created = new Date(t.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
      });

      if (recentWeek.length > 5) score -= 10; // High recent volume
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate engagement health score (0-100)
   * Based on: activity recency, activity frequency, contact touchpoints
   */
  private calculateEngagementScore(data: HealthInputData): number {
    let score = 50; // Base score

    // Last activity recency
    if (data.lastActivity) {
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(data.lastActivity.activityDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSinceActivity < 7) score += 30;
      else if (daysSinceActivity < 14) score += 25;
      else if (daysSinceActivity < 30) score += 20;
      else if (daysSinceActivity < 60) score += 10;
      else if (daysSinceActivity > 90) score -= 10;
      else if (daysSinceActivity > 180) score -= 20;
    } else {
      score -= 20; // No recent activity
    }

    // Activity volume
    if (data.activities) {
      const recentActivities = data.activities.filter((a) => {
        const activityDate = new Date(a.activityDate);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return activityDate >= threeMonthsAgo;
      });

      if (recentActivities.length > 20) score += 15;
      else if (recentActivities.length > 10) score += 10;
      else if (recentActivities.length > 5) score += 5;
      else if (recentActivities.length === 0) score -= 10;
    }

    // Activity diversity (different types of engagement)
    if (data.activities && data.activities.length > 0) {
      const activityTypes = new Set(data.activities.map((a) => a.type));
      if (activityTypes.size >= 4) score += 10;
      else if (activityTypes.size >= 3) score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine overall health trend
   */
  private determineTrend(
    data: HealthInputData,
    currentScore: number
  ): "improving" | "stable" | "declining" {
    // Analyze revenue trend
    if (data.revenueTrend && data.revenueTrend.length >= 3) {
      const recentMonths = data.revenueTrend.slice(-3);
      const avgRecent =
        recentMonths.reduce((sum, r) => sum + r.totalRevenue, 0) / 3;
      const avgPrevious =
        data.revenueTrend
          .slice(-6, -3)
          .reduce((sum, r) => sum + r.totalRevenue, 0) / 3 || avgRecent;

      const revenueTrend = (avgRecent - avgPrevious) / (avgPrevious || 1);

      if (revenueTrend > 0.1) return "improving";
      if (revenueTrend < -0.1) return "declining";
    }

    // Check support ticket trend
    if (data.supportMetrics) {
      const openRatio =
        data.supportMetrics.openTickets / (data.supportMetrics.totalTickets || 1);
      if (openRatio > 0.5) return "declining";
    }

    // Check payment trend
    if (data.balance && data.balance.daysOverdue > 60) {
      return "declining";
    }

    return "stable";
  }

  /**
   * Determine risk level based on score and specific factors
   */
  private determineRiskLevel(
    score: number,
    data: HealthInputData
  ): "low" | "medium" | "high" | "critical" {
    // Critical conditions
    if (
      score < 40 ||
      (data.balance && data.balance.daysOverdue > 90) ||
      (data.supportMetrics && data.supportMetrics.openTickets > 10)
    ) {
      return "critical";
    }

    // High risk conditions
    if (
      score < this.config.thresholds.atRiskHealth ||
      (data.balance &&
        data.balance.daysOverdue > this.config.thresholds.paymentDaysOverdueWarning)
    ) {
      return "high";
    }

    // Medium risk conditions
    if (score < 70) {
      return "medium";
    }

    return "low";
  }

  /**
   * Get detailed health factors and recommendations
   */
  getHealthFactors(
    accountId: string,
    data: HealthInputData
  ): HealthFactors {
    const factors: HealthFactor[] = [];
    const recommendations: string[] = [];

    // Revenue factors
    if (data.revenueTrend && data.revenueTrend.length > 0) {
      const totalRevenue = data.revenueTrend.reduce(
        (sum, r) => sum + r.totalRevenue,
        0
      );
      const avgMonthly = totalRevenue / data.revenueTrend.length;

      factors.push({
        category: "revenue",
        name: "Monthly Revenue Average",
        value: `$${avgMonthly.toLocaleString()}`,
        impact: avgMonthly > 10000 ? "positive" : avgMonthly > 1000 ? "neutral" : "negative",
        weight: this.config.weights.revenue,
        contribution: avgMonthly > 10000 ? 20 : avgMonthly > 1000 ? 10 : 5,
        description: "Average monthly revenue over the analysis period",
      });

      if (data.revenueTrend.length >= 2) {
        const recent = data.revenueTrend.slice(-3);
        const older = data.revenueTrend.slice(-6, -3);
        const recentAvg = recent.reduce((s, r) => s + r.totalRevenue, 0) / recent.length;
        const olderAvg =
          older.reduce((s, r) => s + r.totalRevenue, 0) / older.length || recentAvg;
        const trend = ((recentAvg - olderAvg) / olderAvg) * 100;

        factors.push({
          category: "revenue",
          name: "Revenue Trend",
          value: `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%`,
          impact: trend > 5 ? "positive" : trend < -5 ? "negative" : "neutral",
          weight: this.config.weights.revenue,
          contribution: trend > 5 ? 15 : trend < -5 ? -15 : 0,
          description: "Revenue change comparing recent vs previous periods",
        });

        if (trend < -10) {
          recommendations.push(
            "Revenue is declining. Schedule a business review to understand changing needs."
          );
        }
      }
    }

    // Payment factors
    if (data.balance) {
      factors.push({
        category: "payment",
        name: "Outstanding Balance",
        value: `$${data.balance.totalBalance.toLocaleString()}`,
        impact: data.balance.totalBalance > 0 ? "neutral" : "positive",
        weight: this.config.weights.payment,
        contribution: data.balance.overdueBalance > 0 ? -10 : 0,
        description: "Total amount currently owed",
      });

      if (data.balance.overdueBalance > 0) {
        factors.push({
          category: "payment",
          name: "Overdue Amount",
          value: `$${data.balance.overdueBalance.toLocaleString()}`,
          impact: "negative",
          weight: this.config.weights.payment,
          contribution: -15,
          description: "Amount past due date",
        });

        factors.push({
          category: "payment",
          name: "Days Overdue",
          value: data.balance.daysOverdue,
          impact: data.balance.daysOverdue > 30 ? "negative" : "neutral",
          weight: this.config.weights.payment,
          contribution: data.balance.daysOverdue > 60 ? -20 : data.balance.daysOverdue > 30 ? -10 : -5,
          description: "Maximum days any invoice is past due",
        });

        if (data.balance.daysOverdue > 30) {
          recommendations.push(
            "Account has overdue invoices. Escalate to collections or offer payment plan."
          );
        }
      }
    }

    // Support factors
    if (data.supportMetrics) {
      factors.push({
        category: "support",
        name: "Open Tickets",
        value: data.supportMetrics.openTickets,
        impact:
          data.supportMetrics.openTickets > 5
            ? "negative"
            : data.supportMetrics.openTickets > 0
            ? "neutral"
            : "positive",
        weight: this.config.weights.support,
        contribution: data.supportMetrics.openTickets > 5 ? -15 : 0,
        description: "Number of currently open support tickets",
      });

      const urgentHigh =
        data.supportMetrics.ticketsByPriority.urgent +
        data.supportMetrics.ticketsByPriority.high;
      if (urgentHigh > 0) {
        factors.push({
          category: "support",
          name: "High Priority Tickets",
          value: urgentHigh,
          impact: "negative",
          weight: this.config.weights.support,
          contribution: -10 * urgentHigh,
          description: "Number of high/urgent priority open tickets",
        });

        recommendations.push(
          `Account has ${urgentHigh} high-priority support tickets. Prioritize resolution.`
        );
      }

      if (data.supportMetrics.averageSatisfactionScore) {
        factors.push({
          category: "support",
          name: "Satisfaction Score",
          value: data.supportMetrics.averageSatisfactionScore.toFixed(1),
          impact:
            data.supportMetrics.averageSatisfactionScore >= 4
              ? "positive"
              : data.supportMetrics.averageSatisfactionScore >= 3
              ? "neutral"
              : "negative",
          weight: this.config.weights.support,
          contribution:
            data.supportMetrics.averageSatisfactionScore >= 4
              ? 10
              : data.supportMetrics.averageSatisfactionScore < 3
              ? -10
              : 0,
          description: "Average customer satisfaction rating",
        });

        if (data.supportMetrics.averageSatisfactionScore < 3.5) {
          recommendations.push(
            "Customer satisfaction is low. Review recent interactions and address concerns."
          );
        }
      }
    }

    // Engagement factors
    if (data.lastActivity) {
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(data.lastActivity.activityDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      factors.push({
        category: "engagement",
        name: "Days Since Last Contact",
        value: daysSinceActivity,
        impact:
          daysSinceActivity < 14
            ? "positive"
            : daysSinceActivity < 30
            ? "neutral"
            : "negative",
        weight: this.config.weights.engagement,
        contribution: daysSinceActivity < 14 ? 15 : daysSinceActivity > 60 ? -15 : 0,
        description: "Number of days since the last recorded activity",
      });

      if (daysSinceActivity > 60) {
        recommendations.push(
          "No recent engagement with this account. Schedule a check-in call."
        );
      }
    } else {
      factors.push({
        category: "engagement",
        name: "Last Contact",
        value: "Unknown",
        impact: "negative",
        weight: this.config.weights.engagement,
        contribution: -10,
        description: "No activity records found",
      });

      recommendations.push(
        "No engagement history found. Initiate contact to establish relationship."
      );
    }

    if (data.activities) {
      const activityCount = data.activities.length;
      factors.push({
        category: "engagement",
        name: "Total Activities (90 days)",
        value: activityCount,
        impact: activityCount > 10 ? "positive" : activityCount > 5 ? "neutral" : "negative",
        weight: this.config.weights.engagement,
        contribution: activityCount > 10 ? 10 : activityCount < 3 ? -5 : 0,
        description: "Number of logged activities in the past 90 days",
      });
    }

    return {
      accountId,
      factors,
      recommendations,
    };
  }

  /**
   * Check if an account is at risk
   */
  isAtRisk(score: HealthScore): boolean {
    return (
      score.overallScore < this.config.thresholds.atRiskHealth ||
      score.riskLevel === "high" ||
      score.riskLevel === "critical"
    );
  }

  /**
   * Get the configuration
   */
  getConfig(): HealthConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createHealthCalculator(): HealthCalculator {
  return new HealthCalculator({
    weights: {
      revenue: parseFloat(process.env.HEALTH_WEIGHT_REVENUE || "0.30"),
      payment: parseFloat(process.env.HEALTH_WEIGHT_PAYMENT || "0.25"),
      support: parseFloat(process.env.HEALTH_WEIGHT_SUPPORT || "0.25"),
      engagement: parseFloat(process.env.HEALTH_WEIGHT_ENGAGEMENT || "0.20"),
    },
    thresholds: {
      atRiskHealth: parseInt(process.env.AT_RISK_HEALTH_THRESHOLD || "60"),
      revenueDecline: parseFloat(process.env.REVENUE_DECLINE_THRESHOLD || "0.15"),
      supportTicketsWarning: parseInt(
        process.env.SUPPORT_TICKETS_WARNING || "5"
      ),
      paymentDaysOverdueWarning: parseInt(
        process.env.PAYMENT_DAYS_OVERDUE_WARNING || "30"
      ),
    },
  });
}
