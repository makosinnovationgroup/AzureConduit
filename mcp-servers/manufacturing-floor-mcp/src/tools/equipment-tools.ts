import { z } from 'zod';
import { getMESConnector } from '../connectors/mes';
import logger from '../utils/logger';

// Additional interfaces for equipment data
interface Equipment {
  equipment_id: string;
  name: string;
  type: string;
  line_id: string;
  line_name: string;
  status: 'running' | 'idle' | 'down' | 'maintenance' | 'changeover';
  current_job: string | null;
  operator: string | null;
  runtime_hours_today: number;
  total_runtime_hours: number;
  last_maintenance: string;
  next_scheduled_maintenance: string;
  alerts: {
    type: 'warning' | 'error';
    message: string;
    timestamp: string;
  }[];
}

interface DowntimeEvent {
  event_id: string;
  equipment_id: string;
  equipment_name: string;
  line_id: string;
  downtime_type: 'unplanned' | 'planned' | 'changeover';
  reason_code: string;
  reason_description: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  impact: {
    units_lost: number;
    cost_estimate: number;
  };
  notes: string | null;
  reported_by: string;
}

interface MaintenanceTask {
  task_id: string;
  equipment_id: string;
  equipment_name: string;
  line_id: string;
  task_type: 'preventive' | 'corrective' | 'predictive' | 'calibration';
  description: string;
  scheduled_date: string;
  estimated_duration_hours: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'scheduled' | 'in_progress' | 'completed' | 'overdue';
  assigned_to: string | null;
  parts_required: {
    part_number: string;
    description: string;
    quantity: number;
    available: boolean;
  }[];
  last_completed: string | null;
  frequency: string;
}

// Schema definitions
export const getEquipmentStatusSchema = z.object({
  line_id: z.string().optional().describe('Filter by production line'),
  status: z.enum(['running', 'idle', 'down', 'maintenance', 'changeover']).optional().describe('Filter by equipment status')
});

export const getDowntimeReportSchema = z.object({
  equipment_id: z.string().optional().describe('Filter by specific equipment'),
  period: z.enum(['today', 'week', 'month']).default('today').describe('Time period for the report'),
  reason_code: z.string().optional().describe('Filter by downtime reason code')
});

export const getMaintenanceScheduleSchema = z.object({
  equipment_id: z.string().optional().describe('Filter by specific equipment'),
  days_ahead: z.number().min(1).max(90).default(7).describe('Number of days to look ahead'),
  include_overdue: z.boolean().default(true).describe('Include overdue maintenance tasks')
});

// Mock data generator for equipment (would connect to MES in production)
function getMockEquipmentStatus(params?: { line_id?: string; status?: string }): Equipment[] {
  const equipment: Equipment[] = [
    {
      equipment_id: 'EQ-001',
      name: 'CNC Lathe #1',
      type: 'CNC Lathe',
      line_id: 'LINE-004',
      line_name: 'CNC Machining Center',
      status: 'running',
      current_job: 'WO-2024-0001',
      operator: 'Mike Wilson',
      runtime_hours_today: 6.5,
      total_runtime_hours: 12450,
      last_maintenance: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      next_scheduled_maintenance: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
      alerts: []
    },
    {
      equipment_id: 'EQ-002',
      name: 'CNC Lathe #2',
      type: 'CNC Lathe',
      line_id: 'LINE-004',
      line_name: 'CNC Machining Center',
      status: 'maintenance',
      current_job: null,
      operator: null,
      runtime_hours_today: 0,
      total_runtime_hours: 11890,
      last_maintenance: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      next_scheduled_maintenance: new Date().toISOString(),
      alerts: [
        {
          type: 'warning',
          message: 'Scheduled maintenance in progress',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        }
      ]
    },
    {
      equipment_id: 'EQ-003',
      name: 'Assembly Robot A1',
      type: 'Robotic Arm',
      line_id: 'LINE-001',
      line_name: 'Assembly Line 1',
      status: 'running',
      current_job: 'WO-2024-0001',
      operator: null,
      runtime_hours_today: 7.2,
      total_runtime_hours: 8920,
      last_maintenance: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      next_scheduled_maintenance: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
      alerts: []
    },
    {
      equipment_id: 'EQ-004',
      name: 'Assembly Robot A2',
      type: 'Robotic Arm',
      line_id: 'LINE-001',
      line_name: 'Assembly Line 1',
      status: 'down',
      current_job: null,
      operator: null,
      runtime_hours_today: 3.1,
      total_runtime_hours: 8756,
      last_maintenance: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      next_scheduled_maintenance: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
      alerts: [
        {
          type: 'error',
          message: 'Gripper malfunction - technician dispatched',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString()
        }
      ]
    },
    {
      equipment_id: 'EQ-005',
      name: 'Conveyor System C1',
      type: 'Conveyor',
      line_id: 'LINE-001',
      line_name: 'Assembly Line 1',
      status: 'running',
      current_job: 'WO-2024-0001',
      operator: null,
      runtime_hours_today: 7.5,
      total_runtime_hours: 15670,
      last_maintenance: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      next_scheduled_maintenance: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      alerts: []
    },
    {
      equipment_id: 'EQ-006',
      name: 'Packaging Machine P1',
      type: 'Packaging',
      line_id: 'LINE-003',
      line_name: 'Packaging Line 1',
      status: 'idle',
      current_job: null,
      operator: 'Lisa Brown',
      runtime_hours_today: 0,
      total_runtime_hours: 6780,
      last_maintenance: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      next_scheduled_maintenance: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      alerts: []
    },
    {
      equipment_id: 'EQ-007',
      name: 'Welding Station W1',
      type: 'Welding',
      line_id: 'LINE-002',
      line_name: 'Assembly Line 2',
      status: 'running',
      current_job: 'WO-2024-0002',
      operator: 'Tom Anderson',
      runtime_hours_today: 5.8,
      total_runtime_hours: 9340,
      last_maintenance: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      next_scheduled_maintenance: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
      alerts: [
        {
          type: 'warning',
          message: 'Wire feed rate fluctuation detected',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  ];

  let filtered = equipment;
  if (params?.line_id) {
    filtered = filtered.filter(e => e.line_id === params.line_id);
  }
  if (params?.status) {
    filtered = filtered.filter(e => e.status === params.status);
  }

  return filtered;
}

function getMockDowntimeReport(params?: { equipment_id?: string; period?: string; reason_code?: string }): DowntimeEvent[] {
  const events: DowntimeEvent[] = [
    {
      event_id: 'DT-2024-0234',
      equipment_id: 'EQ-004',
      equipment_name: 'Assembly Robot A2',
      line_id: 'LINE-001',
      downtime_type: 'unplanned',
      reason_code: 'EQ-FAIL',
      reason_description: 'Gripper malfunction',
      start_time: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      end_time: null,
      duration_minutes: 45,
      impact: {
        units_lost: 38,
        cost_estimate: 1520
      },
      notes: 'Technician en route, ETA 15 minutes',
      reported_by: 'John Smith'
    },
    {
      event_id: 'DT-2024-0233',
      equipment_id: 'EQ-002',
      equipment_name: 'CNC Lathe #2',
      line_id: 'LINE-004',
      downtime_type: 'planned',
      reason_code: 'PM-SCHED',
      reason_description: 'Scheduled preventive maintenance',
      start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      end_time: null,
      duration_minutes: 120,
      impact: {
        units_lost: 0,
        cost_estimate: 450
      },
      notes: 'Replacing spindle bearings, lubricant change',
      reported_by: 'Maintenance Team'
    },
    {
      event_id: 'DT-2024-0232',
      equipment_id: 'EQ-001',
      equipment_name: 'CNC Lathe #1',
      line_id: 'LINE-004',
      downtime_type: 'changeover',
      reason_code: 'SETUP',
      reason_description: 'Product changeover',
      start_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 30,
      impact: {
        units_lost: 25,
        cost_estimate: 200
      },
      notes: 'Changeover from Part A to Part B',
      reported_by: 'Mike Wilson'
    },
    {
      event_id: 'DT-2024-0231',
      equipment_id: 'EQ-003',
      equipment_name: 'Assembly Robot A1',
      line_id: 'LINE-001',
      downtime_type: 'unplanned',
      reason_code: 'MAT-SHORT',
      reason_description: 'Material shortage - waiting for parts',
      start_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 30,
      impact: {
        units_lost: 60,
        cost_estimate: 850
      },
      notes: 'Component XR-42 delivery delayed',
      reported_by: 'Production Supervisor'
    },
    {
      event_id: 'DT-2024-0230',
      equipment_id: 'EQ-007',
      equipment_name: 'Welding Station W1',
      line_id: 'LINE-002',
      downtime_type: 'unplanned',
      reason_code: 'QUAL-ISSUE',
      reason_description: 'Quality issue - weld inspection failure',
      start_time: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() - 7.5 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 30,
      impact: {
        units_lost: 15,
        cost_estimate: 425
      },
      notes: 'Adjusted wire feed settings, quality approved restart',
      reported_by: 'Tom Anderson'
    }
  ];

  let filtered = events;
  if (params?.equipment_id) {
    filtered = filtered.filter(e => e.equipment_id === params.equipment_id);
  }
  if (params?.reason_code) {
    filtered = filtered.filter(e => e.reason_code === params.reason_code);
  }

  return filtered;
}

function getMockMaintenanceSchedule(params?: { equipment_id?: string; days_ahead?: number; include_overdue?: boolean }): MaintenanceTask[] {
  const daysAhead = params?.days_ahead || 7;
  const includeOverdue = params?.include_overdue !== false;
  const now = new Date();

  const tasks: MaintenanceTask[] = [
    {
      task_id: 'MT-2024-0567',
      equipment_id: 'EQ-002',
      equipment_name: 'CNC Lathe #2',
      line_id: 'LINE-004',
      task_type: 'preventive',
      description: 'Replace spindle bearings, change lubricant, inspect coolant system',
      scheduled_date: new Date().toISOString(),
      estimated_duration_hours: 4,
      priority: 'high',
      status: 'in_progress',
      assigned_to: 'David Martinez',
      parts_required: [
        { part_number: 'BRG-45678', description: 'Spindle Bearing Set', quantity: 2, available: true },
        { part_number: 'LUB-12345', description: 'Spindle Lubricant 5L', quantity: 1, available: true }
      ],
      last_completed: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      frequency: 'Monthly'
    },
    {
      task_id: 'MT-2024-0568',
      equipment_id: 'EQ-004',
      equipment_name: 'Assembly Robot A2',
      line_id: 'LINE-001',
      task_type: 'corrective',
      description: 'Replace gripper actuator, recalibrate arm position',
      scheduled_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      estimated_duration_hours: 2,
      priority: 'critical',
      status: 'scheduled',
      assigned_to: 'David Martinez',
      parts_required: [
        { part_number: 'ACT-78901', description: 'Gripper Actuator Assembly', quantity: 1, available: true }
      ],
      last_completed: null,
      frequency: 'As needed'
    },
    {
      task_id: 'MT-2024-0569',
      equipment_id: 'EQ-007',
      equipment_name: 'Welding Station W1',
      line_id: 'LINE-002',
      task_type: 'preventive',
      description: 'Clean torch tips, inspect wire feed mechanism, check gas flow',
      scheduled_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      estimated_duration_hours: 1.5,
      priority: 'normal',
      status: 'scheduled',
      assigned_to: 'Sarah Kim',
      parts_required: [
        { part_number: 'TIP-34567', description: 'Torch Tip Set', quantity: 5, available: true }
      ],
      last_completed: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      frequency: 'Bi-weekly'
    },
    {
      task_id: 'MT-2024-0570',
      equipment_id: 'EQ-005',
      equipment_name: 'Conveyor System C1',
      line_id: 'LINE-001',
      task_type: 'predictive',
      description: 'Belt tension adjustment, motor vibration analysis',
      scheduled_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      estimated_duration_hours: 2,
      priority: 'normal',
      status: 'scheduled',
      assigned_to: null,
      parts_required: [],
      last_completed: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      frequency: 'Monthly'
    },
    {
      task_id: 'MT-2024-0565',
      equipment_id: 'EQ-001',
      equipment_name: 'CNC Lathe #1',
      line_id: 'LINE-004',
      task_type: 'calibration',
      description: 'Tool offset calibration, axis alignment verification',
      scheduled_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      estimated_duration_hours: 3,
      priority: 'high',
      status: 'overdue',
      assigned_to: null,
      parts_required: [],
      last_completed: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
      frequency: 'Monthly'
    },
    {
      task_id: 'MT-2024-0571',
      equipment_id: 'EQ-006',
      equipment_name: 'Packaging Machine P1',
      line_id: 'LINE-003',
      task_type: 'preventive',
      description: 'Sealing bar replacement, sensor cleaning, conveyor alignment',
      scheduled_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      estimated_duration_hours: 2.5,
      priority: 'normal',
      status: 'scheduled',
      assigned_to: 'Sarah Kim',
      parts_required: [
        { part_number: 'SEAL-23456', description: 'Sealing Bar Assembly', quantity: 1, available: false }
      ],
      last_completed: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      frequency: 'Monthly'
    }
  ];

  let filtered = tasks;

  // Filter by equipment
  if (params?.equipment_id) {
    filtered = filtered.filter(t => t.equipment_id === params.equipment_id);
  }

  // Filter by date range
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  filtered = filtered.filter(t => {
    const taskDate = new Date(t.scheduled_date);
    if (t.status === 'overdue' && includeOverdue) {
      return true;
    }
    return taskDate <= futureDate;
  });

  // Exclude overdue if not requested
  if (!includeOverdue) {
    filtered = filtered.filter(t => t.status !== 'overdue');
  }

  return filtered;
}

// Tool handlers
export async function getEquipmentStatus(params: z.infer<typeof getEquipmentStatusSchema>) {
  logger.info('Getting equipment status', params);

  const equipment = getMockEquipmentStatus(params);

  logger.info('Equipment status retrieved', {
    total_equipment: equipment.length,
    running: equipment.filter(e => e.status === 'running').length
  });

  return {
    equipment: equipment.map(e => ({
      equipment_id: e.equipment_id,
      name: e.name,
      type: e.type,
      location: {
        line_id: e.line_id,
        line_name: e.line_name
      },
      status: e.status,
      current_job: e.current_job,
      operator: e.operator,
      runtime: {
        today_hours: e.runtime_hours_today,
        total_hours: e.total_runtime_hours
      },
      maintenance: {
        last_completed: e.last_maintenance,
        next_scheduled: e.next_scheduled_maintenance,
        days_until_next: Math.ceil(
          (new Date(e.next_scheduled_maintenance).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      },
      alerts: e.alerts
    })),
    summary: {
      total_equipment: equipment.length,
      by_status: {
        running: equipment.filter(e => e.status === 'running').length,
        idle: equipment.filter(e => e.status === 'idle').length,
        down: equipment.filter(e => e.status === 'down').length,
        maintenance: equipment.filter(e => e.status === 'maintenance').length,
        changeover: equipment.filter(e => e.status === 'changeover').length
      },
      equipment_with_alerts: equipment.filter(e => e.alerts.length > 0).length,
      availability_percent: equipment.length > 0
        ? Math.round((equipment.filter(e => e.status === 'running' || e.status === 'idle').length / equipment.length) * 100)
        : 0
    },
    alerts: equipment
      .filter(e => e.alerts.length > 0)
      .flatMap(e => e.alerts.map(a => ({
        equipment_id: e.equipment_id,
        equipment_name: e.name,
        alert_type: a.type,
        message: a.message,
        timestamp: a.timestamp
      })))
  };
}

export async function getDowntimeReport(params: z.infer<typeof getDowntimeReportSchema>) {
  logger.info('Getting downtime report', params);

  const events = getMockDowntimeReport(params);

  const totalDowntimeMinutes = events.reduce((sum, e) => sum + e.duration_minutes, 0);
  const totalUnitsLost = events.reduce((sum, e) => sum + e.impact.units_lost, 0);
  const totalCost = events.reduce((sum, e) => sum + e.impact.cost_estimate, 0);

  logger.info('Downtime report retrieved', {
    total_events: events.length,
    total_downtime_minutes: totalDowntimeMinutes
  });

  return {
    period: params.period || 'today',
    downtime_events: events.map(e => ({
      event_id: e.event_id,
      equipment: {
        id: e.equipment_id,
        name: e.equipment_name
      },
      line_id: e.line_id,
      downtime_type: e.downtime_type,
      reason: {
        code: e.reason_code,
        description: e.reason_description
      },
      timing: {
        start: e.start_time,
        end: e.end_time,
        duration_minutes: e.duration_minutes,
        is_ongoing: e.end_time === null
      },
      impact: {
        units_lost: e.impact.units_lost,
        estimated_cost: e.impact.cost_estimate
      },
      notes: e.notes,
      reported_by: e.reported_by
    })),
    summary: {
      total_events: events.length,
      total_downtime_minutes: totalDowntimeMinutes,
      total_downtime_hours: Math.round(totalDowntimeMinutes / 60 * 10) / 10,
      by_type: {
        unplanned: events.filter(e => e.downtime_type === 'unplanned').length,
        planned: events.filter(e => e.downtime_type === 'planned').length,
        changeover: events.filter(e => e.downtime_type === 'changeover').length
      },
      total_units_lost: totalUnitsLost,
      total_estimated_cost: totalCost,
      ongoing_events: events.filter(e => e.end_time === null).length
    },
    top_reasons: Object.entries(
      events.reduce((acc, e) => {
        acc[e.reason_description] = (acc[e.reason_description] || 0) + e.duration_minutes;
        return acc;
      }, {} as Record<string, number>)
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reason, minutes]) => ({ reason, total_minutes: minutes }))
  };
}

export async function getMaintenanceSchedule(params: z.infer<typeof getMaintenanceScheduleSchema>) {
  logger.info('Getting maintenance schedule', params);

  const tasks = getMockMaintenanceSchedule(params);

  logger.info('Maintenance schedule retrieved', {
    total_tasks: tasks.length,
    overdue: tasks.filter(t => t.status === 'overdue').length
  });

  return {
    schedule_period: {
      days_ahead: params.days_ahead || 7,
      include_overdue: params.include_overdue !== false
    },
    maintenance_tasks: tasks.map(t => ({
      task_id: t.task_id,
      equipment: {
        id: t.equipment_id,
        name: t.equipment_name
      },
      line_id: t.line_id,
      task_type: t.task_type,
      description: t.description,
      scheduled_date: t.scheduled_date,
      estimated_duration_hours: t.estimated_duration_hours,
      priority: t.priority,
      status: t.status,
      assigned_to: t.assigned_to,
      parts_required: t.parts_required,
      parts_available: t.parts_required.every(p => p.available),
      last_completed: t.last_completed,
      frequency: t.frequency,
      days_until_due: Math.ceil(
        (new Date(t.scheduled_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    })),
    summary: {
      total_tasks: tasks.length,
      by_status: {
        scheduled: tasks.filter(t => t.status === 'scheduled').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        overdue: tasks.filter(t => t.status === 'overdue').length
      },
      by_priority: {
        critical: tasks.filter(t => t.priority === 'critical').length,
        high: tasks.filter(t => t.priority === 'high').length,
        normal: tasks.filter(t => t.priority === 'normal').length,
        low: tasks.filter(t => t.priority === 'low').length
      },
      by_type: {
        preventive: tasks.filter(t => t.task_type === 'preventive').length,
        corrective: tasks.filter(t => t.task_type === 'corrective').length,
        predictive: tasks.filter(t => t.task_type === 'predictive').length,
        calibration: tasks.filter(t => t.task_type === 'calibration').length
      },
      total_estimated_hours: tasks.reduce((sum, t) => sum + t.estimated_duration_hours, 0),
      tasks_missing_parts: tasks.filter(t => t.parts_required.some(p => !p.available)).length
    },
    attention_required: [
      ...tasks.filter(t => t.status === 'overdue').map(t => ({
        task_id: t.task_id,
        equipment_name: t.equipment_name,
        issue: 'OVERDUE: Maintenance task past scheduled date',
        priority: 'critical' as const
      })),
      ...tasks.filter(t => t.priority === 'critical' && t.status === 'scheduled').map(t => ({
        task_id: t.task_id,
        equipment_name: t.equipment_name,
        issue: 'Critical priority maintenance scheduled',
        priority: 'high' as const
      })),
      ...tasks.filter(t => t.parts_required.some(p => !p.available)).map(t => ({
        task_id: t.task_id,
        equipment_name: t.equipment_name,
        issue: 'Missing parts required for maintenance',
        priority: 'medium' as const
      }))
    ]
  };
}

// Tool definitions for MCP registration
export const equipmentToolDefinitions = [
  {
    name: 'get_equipment_status',
    description: 'Get the current status of production equipment including running state, current job, runtime hours, and any active alerts. Essential for maintenance teams and production supervisors to monitor equipment health.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        line_id: {
          type: 'string',
          description: 'Filter by production line (e.g., LINE-001)'
        },
        status: {
          type: 'string',
          enum: ['running', 'idle', 'down', 'maintenance', 'changeover'],
          description: 'Filter by equipment status'
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_downtime_report',
    description: 'Get a report of equipment downtime events including unplanned breakdowns, planned maintenance, and changeovers. Shows duration, reason codes, and production impact. Critical for identifying reliability issues and improvement opportunities.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        equipment_id: {
          type: 'string',
          description: 'Filter by specific equipment ID'
        },
        period: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Time period for the report (default: today)',
          default: 'today'
        },
        reason_code: {
          type: 'string',
          description: 'Filter by downtime reason code'
        }
      },
      required: [] as string[]
    }
  },
  {
    name: 'get_maintenance_schedule',
    description: 'Get the upcoming preventive maintenance schedule including task details, parts required, and assigned technicians. Also shows overdue maintenance that needs attention. Essential for maintenance planning and resource allocation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        equipment_id: {
          type: 'string',
          description: 'Filter by specific equipment ID'
        },
        days_ahead: {
          type: 'number',
          description: 'Number of days to look ahead (1-90, default: 7)',
          minimum: 1,
          maximum: 90,
          default: 7
        },
        include_overdue: {
          type: 'boolean',
          description: 'Include overdue maintenance tasks (default: true)',
          default: true
        }
      },
      required: [] as string[]
    }
  }
];
