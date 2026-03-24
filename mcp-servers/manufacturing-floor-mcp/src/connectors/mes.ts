import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

export interface ProductionLine {
  line_id: string;
  name: string;
  status: 'running' | 'idle' | 'down' | 'maintenance' | 'changeover';
  current_product: string | null;
  current_work_order: string | null;
  shift: string;
  operator_count: number;
  target_rate: number;
  actual_rate: number;
  units_produced: number;
  units_target: number;
  efficiency_percent: number;
  last_updated: string;
}

export interface ProductionScheduleItem {
  schedule_id: string;
  work_order_id: string;
  line_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface OEEMetrics {
  line_id: string;
  line_name: string;
  period: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  planned_production_time: number;
  actual_run_time: number;
  total_units: number;
  good_units: number;
  rejected_units: number;
  downtime_minutes: number;
  ideal_cycle_time: number;
}

export interface MESConfig {
  baseUrl: string;
  apiKey: string;
  plantId: string;
}

class MESConnector {
  private config: MESConfig;
  private client: AxiosInstance;
  private initialized = false;

  constructor(config: MESConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Plant-ID': config.plantId
      },
      timeout: 30000
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing MES connector', {
      baseUrl: this.config.baseUrl,
      plantId: this.config.plantId
    });

    try {
      // Test connection by getting plant info
      await this.client.get('/api/v1/health');
      this.initialized = true;
      logger.info('MES connector initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MES connector', { error });
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getProductionStatus(): Promise<{
    plant_id: string;
    timestamp: string;
    lines: ProductionLine[];
    summary: {
      total_lines: number;
      running: number;
      idle: number;
      down: number;
      maintenance: number;
      overall_efficiency: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting production status');

    try {
      const response = await this.client.get('/api/v1/production/status');
      return response.data;
    } catch (error) {
      logger.error('Failed to get production status', { error });
      // Return mock data for development/demo
      return this.getMockProductionStatus();
    }
  }

  async getProductionSchedule(params: {
    date?: string;
    line_id?: string;
    period?: 'today' | 'week';
  }): Promise<{
    period: string;
    schedule: ProductionScheduleItem[];
    summary: {
      total_orders: number;
      scheduled: number;
      in_progress: number;
      completed: number;
      delayed: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting production schedule', params);

    try {
      const response = await this.client.get('/api/v1/production/schedule', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get production schedule', { error });
      return this.getMockProductionSchedule(params);
    }
  }

  async getLineEfficiency(lineId: string): Promise<OEEMetrics> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting line efficiency', { lineId });

    try {
      const response = await this.client.get(`/api/v1/production/lines/${lineId}/oee`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get line efficiency', { error });
      return this.getMockOEEMetrics(lineId);
    }
  }

  // Mock data methods for development/demo
  private getMockProductionStatus() {
    const lines: ProductionLine[] = [
      {
        line_id: 'LINE-001',
        name: 'Assembly Line 1',
        status: 'running',
        current_product: 'PROD-A1234',
        current_work_order: 'WO-2024-0001',
        shift: 'Day',
        operator_count: 4,
        target_rate: 120,
        actual_rate: 115,
        units_produced: 892,
        units_target: 960,
        efficiency_percent: 92.9,
        last_updated: new Date().toISOString()
      },
      {
        line_id: 'LINE-002',
        name: 'Assembly Line 2',
        status: 'running',
        current_product: 'PROD-B5678',
        current_work_order: 'WO-2024-0002',
        shift: 'Day',
        operator_count: 3,
        target_rate: 80,
        actual_rate: 78,
        units_produced: 624,
        units_target: 640,
        efficiency_percent: 97.5,
        last_updated: new Date().toISOString()
      },
      {
        line_id: 'LINE-003',
        name: 'Packaging Line 1',
        status: 'idle',
        current_product: null,
        current_work_order: null,
        shift: 'Day',
        operator_count: 2,
        target_rate: 200,
        actual_rate: 0,
        units_produced: 0,
        units_target: 0,
        efficiency_percent: 0,
        last_updated: new Date().toISOString()
      },
      {
        line_id: 'LINE-004',
        name: 'CNC Machining Center',
        status: 'maintenance',
        current_product: null,
        current_work_order: null,
        shift: 'Day',
        operator_count: 1,
        target_rate: 50,
        actual_rate: 0,
        units_produced: 234,
        units_target: 400,
        efficiency_percent: 58.5,
        last_updated: new Date().toISOString()
      }
    ];

    return {
      plant_id: this.config.plantId,
      timestamp: new Date().toISOString(),
      lines,
      summary: {
        total_lines: lines.length,
        running: lines.filter(l => l.status === 'running').length,
        idle: lines.filter(l => l.status === 'idle').length,
        down: lines.filter(l => l.status === 'down').length,
        maintenance: lines.filter(l => l.status === 'maintenance').length,
        overall_efficiency: 82.3
      }
    };
  }

  private getMockProductionSchedule(params: { date?: string; line_id?: string; period?: 'today' | 'week' }) {
    const today = new Date();
    const schedule: ProductionScheduleItem[] = [
      {
        schedule_id: 'SCH-001',
        work_order_id: 'WO-2024-0001',
        line_id: 'LINE-001',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A',
        quantity: 1000,
        scheduled_start: new Date(today.setHours(6, 0, 0)).toISOString(),
        scheduled_end: new Date(today.setHours(14, 0, 0)).toISOString(),
        actual_start: new Date(today.setHours(6, 15, 0)).toISOString(),
        status: 'in_progress',
        priority: 'high'
      },
      {
        schedule_id: 'SCH-002',
        work_order_id: 'WO-2024-0002',
        line_id: 'LINE-002',
        product_id: 'PROD-B5678',
        product_name: 'Component B Assembly',
        quantity: 500,
        scheduled_start: new Date(today.setHours(6, 0, 0)).toISOString(),
        scheduled_end: new Date(today.setHours(12, 0, 0)).toISOString(),
        actual_start: new Date(today.setHours(6, 0, 0)).toISOString(),
        status: 'in_progress',
        priority: 'normal'
      },
      {
        schedule_id: 'SCH-003',
        work_order_id: 'WO-2024-0003',
        line_id: 'LINE-001',
        product_id: 'PROD-C9012',
        product_name: 'Premium Widget C',
        quantity: 250,
        scheduled_start: new Date(today.setHours(14, 30, 0)).toISOString(),
        scheduled_end: new Date(today.setHours(22, 0, 0)).toISOString(),
        actual_start: null,
        status: 'scheduled',
        priority: 'urgent'
      },
      {
        schedule_id: 'SCH-004',
        work_order_id: 'WO-2024-0004',
        line_id: 'LINE-003',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A - Packaging',
        quantity: 1000,
        scheduled_start: new Date(today.setHours(15, 0, 0)).toISOString(),
        scheduled_end: new Date(today.setHours(20, 0, 0)).toISOString(),
        actual_start: null,
        status: 'scheduled',
        priority: 'high'
      }
    ];

    let filteredSchedule = schedule;
    if (params.line_id) {
      filteredSchedule = schedule.filter(s => s.line_id === params.line_id);
    }

    return {
      period: params.period || 'today',
      schedule: filteredSchedule,
      summary: {
        total_orders: filteredSchedule.length,
        scheduled: filteredSchedule.filter(s => s.status === 'scheduled').length,
        in_progress: filteredSchedule.filter(s => s.status === 'in_progress').length,
        completed: filteredSchedule.filter(s => s.status === 'completed').length,
        delayed: filteredSchedule.filter(s => s.status === 'delayed').length
      }
    };
  }

  private getMockOEEMetrics(lineId: string): OEEMetrics {
    const lineNames: Record<string, string> = {
      'LINE-001': 'Assembly Line 1',
      'LINE-002': 'Assembly Line 2',
      'LINE-003': 'Packaging Line 1',
      'LINE-004': 'CNC Machining Center'
    };

    return {
      line_id: lineId,
      line_name: lineNames[lineId] || `Line ${lineId}`,
      period: 'current_shift',
      availability: 91.2,
      performance: 94.5,
      quality: 98.7,
      oee: 85.1,
      planned_production_time: 480,
      actual_run_time: 437,
      total_units: 892,
      good_units: 880,
      rejected_units: 12,
      downtime_minutes: 43,
      ideal_cycle_time: 0.5
    };
  }

  getConfig(): { baseUrl: string; plantId: string } {
    return {
      baseUrl: this.config.baseUrl,
      plantId: this.config.plantId
    };
  }

  async close(): Promise<void> {
    logger.info('Closing MES connector');
    this.initialized = false;
  }
}

// Singleton instance
let connector: MESConnector | null = null;

export function getMESConnector(): MESConnector {
  if (!connector) {
    const config: MESConfig = {
      baseUrl: process.env.MES_BASE_URL || 'http://localhost:8080',
      apiKey: process.env.MES_API_KEY || '',
      plantId: process.env.MES_PLANT_ID || 'PLANT-001'
    };
    connector = new MESConnector(config);
  }
  return connector;
}

export function resetMESConnector(): void {
  if (connector) {
    connector.close();
    connector = null;
  }
}

export default MESConnector;
