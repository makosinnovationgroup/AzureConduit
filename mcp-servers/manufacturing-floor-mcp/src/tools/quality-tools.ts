import { z } from 'zod';
import { getQualityConnector } from '../connectors/quality';
import logger from '../utils/logger';

// Schema definitions
export const getQualityMetricsSchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today').describe('Time period for metrics'),
  line_id: z.string().optional().describe('Filter by specific production line')
});

export const getRecentDefectsSchema = z.object({
  limit: z.number().min(1).max(100).default(10).describe('Maximum number of defects to return'),
  severity: z.enum(['minor', 'major', 'critical']).optional().describe('Filter by defect severity'),
  status: z.enum(['open', 'investigating', 'resolved', 'closed']).optional().describe('Filter by defect status')
});

export const getQualityHoldsSchema = z.object({});

export const getInspectionResultsSchema = z.object({
  limit: z.number().min(1).max(100).default(10).describe('Maximum number of inspection results to return'),
  type: z.enum(['incoming', 'in_process', 'final', 'random']).optional().describe('Filter by inspection type'),
  result: z.enum(['pass', 'fail', 'conditional']).optional().describe('Filter by inspection result')
});

// Tool handlers
export async function getQualityMetrics(params: z.infer<typeof getQualityMetricsSchema>) {
  logger.info('Getting quality metrics', params);

  const qualityConnector = getQualityConnector();
  const metrics = await qualityConnector.getQualityMetrics({
    period: params.period,
    line_id: params.line_id
  });

  logger.info('Quality metrics retrieved', {
    period: metrics.period,
    first_pass_yield: metrics.first_pass_yield
  });

  return {
    period: metrics.period,
    date_range: {
      start: metrics.start_date,
      end: metrics.end_date
    },
    key_metrics: {
      first_pass_yield: {
        value: metrics.first_pass_yield,
        unit: 'percent',
        target: 98.0,
        status: metrics.first_pass_yield >= 98.0 ? 'on_target' : 'below_target'
      },
      overall_defect_rate: {
        value: metrics.overall_defect_rate,
        unit: 'percent',
        target: 1.0,
        status: metrics.overall_defect_rate <= 1.0 ? 'on_target' : 'above_target'
      },
      scrap_rate: {
        value: metrics.scrap_rate,
        unit: 'percent'
      },
      rework_rate: {
        value: metrics.rework_rate,
        unit: 'percent'
      },
      customer_returns_rate: {
        value: metrics.customer_returns_rate,
        unit: 'percent'
      }
    },
    inspection_summary: {
      total_units_inspected: metrics.total_units_inspected,
      total_defects_found: metrics.total_defects
    },
    defects_by_type: metrics.defects_by_type.map(d => ({
      type: d.type,
      count: d.count,
      percentage_of_total: d.percentage
    })),
    defects_by_line: metrics.defects_by_line.map(d => ({
      line_id: d.line_id,
      line_name: d.line_name,
      defect_count: d.defect_count,
      defect_rate_percent: d.defect_rate
    }))
  };
}

export async function getRecentDefects(params: z.infer<typeof getRecentDefectsSchema>) {
  logger.info('Getting recent defects', params);

  const qualityConnector = getQualityConnector();
  const result = await qualityConnector.getRecentDefects({
    limit: params.limit,
    severity: params.severity,
    status: params.status
  });

  logger.info('Recent defects retrieved', {
    total_count: result.total_count,
    open_count: result.summary.open
  });

  return {
    defects: result.defects.map(defect => ({
      defect_id: defect.defect_id,
      work_order_id: defect.work_order_id,
      product: {
        id: defect.product_id,
        name: defect.product_name
      },
      location: {
        line_id: defect.line_id,
        line_name: defect.line_name
      },
      defect_info: {
        type: defect.defect_type,
        code: defect.defect_code,
        severity: defect.severity,
        description: defect.description
      },
      quantity_affected: defect.quantity_affected,
      detected_at: defect.detected_at,
      detected_by: defect.detected_by,
      root_cause: defect.root_cause,
      corrective_action: defect.corrective_action,
      status: defect.status,
      lot_number: defect.lot_number,
      serial_numbers: defect.serial_numbers
    })),
    total_count: result.total_count,
    summary: {
      open_defects: result.summary.open,
      under_investigation: result.summary.investigating,
      critical_severity: result.summary.critical,
      major_severity: result.summary.major
    },
    action_required: result.defects
      .filter(d => d.status === 'open' && (d.severity === 'critical' || d.severity === 'major'))
      .map(d => ({
        defect_id: d.defect_id,
        severity: d.severity,
        description: d.description,
        recommendation: d.severity === 'critical'
          ? 'URGENT: Stop affected line and initiate immediate investigation'
          : 'Schedule investigation within 24 hours'
      }))
  };
}

export async function getQualityHolds() {
  logger.info('Getting quality holds');

  const qualityConnector = getQualityConnector();
  const result = await qualityConnector.getQualityHolds();

  logger.info('Quality holds retrieved', {
    total_active: result.summary.total_active,
    total_quantity: result.summary.total_quantity
  });

  return {
    holds: result.holds.map(hold => ({
      hold_id: hold.hold_id,
      product: {
        id: hold.product_id,
        name: hold.product_name
      },
      lot_number: hold.lot_number,
      quantity_on_hold: hold.quantity,
      hold_type: hold.hold_type,
      reason: hold.reason,
      location: hold.location,
      placed_at: hold.placed_at,
      placed_by: hold.placed_by,
      status: hold.status,
      expected_disposition_date: hold.expected_disposition_date,
      related_defect_id: hold.related_defect_id,
      notes: hold.notes,
      days_on_hold: Math.ceil(
        (Date.now() - new Date(hold.placed_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    })),
    summary: {
      total_active_holds: result.summary.total_active,
      total_quantity_on_hold: result.summary.total_quantity,
      by_hold_type: {
        inspection: result.summary.inspection,
        investigation: result.summary.investigation,
        quarantine: result.summary.quarantine
      }
    },
    attention_required: result.holds
      .filter(h => h.status === 'active')
      .filter(h => {
        const daysOnHold = Math.ceil(
          (Date.now() - new Date(h.placed_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysOnHold > 2 || new Date(h.expected_disposition_date) < new Date();
      })
      .map(h => ({
        hold_id: h.hold_id,
        product_name: h.product_name,
        quantity: h.quantity,
        reason: h.reason,
        alert: new Date(h.expected_disposition_date) < new Date()
          ? 'OVERDUE: Disposition date has passed'
          : 'Extended hold - requires management attention'
      }))
  };
}

export async function getInspectionResults(params: z.infer<typeof getInspectionResultsSchema>) {
  logger.info('Getting inspection results', params);

  const qualityConnector = getQualityConnector();
  const result = await qualityConnector.getInspectionResults({
    limit: params.limit,
    type: params.type,
    result: params.result
  });

  logger.info('Inspection results retrieved', {
    total_inspections: result.summary.total_inspections,
    pass_rate: result.summary.pass_rate
  });

  return {
    inspections: result.inspections.map(inspection => ({
      inspection_id: inspection.inspection_id,
      work_order_id: inspection.work_order_id,
      product: {
        id: inspection.product_id,
        name: inspection.product_name
      },
      inspection_type: inspection.inspection_type,
      inspector: {
        id: inspection.inspector_id,
        name: inspection.inspector_name
      },
      inspected_at: inspection.inspected_at,
      lot_number: inspection.lot_number,
      sample_results: {
        size: inspection.sample_size,
        passed: inspection.passed_count,
        failed: inspection.failed_count,
        pass_rate: inspection.sample_size > 0
          ? Math.round((inspection.passed_count / inspection.sample_size) * 100 * 10) / 10
          : 0
      },
      overall_result: inspection.result,
      measurements: inspection.measurements,
      notes: inspection.notes,
      disposition: inspection.disposition
    })),
    summary: {
      total_inspections: result.summary.total_inspections,
      overall_pass_rate: Math.round(result.summary.pass_rate * 10) / 10,
      overall_fail_rate: Math.round(result.summary.fail_rate * 10) / 10,
      total_samples_inspected: result.summary.total_samples
    },
    failed_inspections: result.inspections
      .filter(i => i.result === 'fail')
      .map(i => ({
        inspection_id: i.inspection_id,
        product_name: i.product_name,
        lot_number: i.lot_number,
        failed_measurements: i.measurements.filter(m => m.status === 'fail'),
        notes: i.notes
      }))
  };
}

// Tool definitions for MCP registration
export const qualityToolDefinitions = [
  {
    name: 'get_quality_metrics',
    description: 'Get quality metrics including first pass yield, defect rates, scrap and rework rates. Shows defects by type and by production line. Essential for quality managers and continuous improvement teams.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Time period for metrics (default: today)',
          default: 'today'
        },
        line_id: {
          type: 'string',
          description: 'Filter metrics by specific production line'
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_recent_defects',
    description: 'Get recent quality defects with details on type, severity, root cause, and corrective actions. Helps quality teams track and resolve issues.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of defects to return (1-100, default: 10)',
          minimum: 1,
          maximum: 100,
          default: 10
        },
        severity: {
          type: 'string',
          enum: ['minor', 'major', 'critical'],
          description: 'Filter by defect severity'
        },
        status: {
          type: 'string',
          enum: ['open', 'investigating', 'resolved', 'closed'],
          description: 'Filter by defect status'
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_quality_holds',
    description: 'Get products currently on quality hold including hold type, reason, quantity, and expected disposition date. Critical for managing quarantined inventory and ensuring proper quality control.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: 'get_inspection_results',
    description: 'Get recent inspection results including pass/fail rates, measurements, and dispositions. Useful for monitoring incoming, in-process, and final inspections.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (1-100, default: 10)',
          minimum: 1,
          maximum: 100,
          default: 10
        },
        type: {
          type: 'string',
          enum: ['incoming', 'in_process', 'final', 'random'],
          description: 'Filter by inspection type'
        },
        result: {
          type: 'string',
          enum: ['pass', 'fail', 'conditional'],
          description: 'Filter by inspection result'
        }
      },
      required: [] as string[]
    }
  }
];
