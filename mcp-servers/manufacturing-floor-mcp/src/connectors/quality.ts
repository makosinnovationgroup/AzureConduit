import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

export interface QualityMetrics {
  period: string;
  start_date: string;
  end_date: string;
  first_pass_yield: number;
  overall_defect_rate: number;
  scrap_rate: number;
  rework_rate: number;
  customer_returns_rate: number;
  total_units_inspected: number;
  total_defects: number;
  defects_by_type: {
    type: string;
    count: number;
    percentage: number;
  }[];
  defects_by_line: {
    line_id: string;
    line_name: string;
    defect_count: number;
    defect_rate: number;
  }[];
}

export interface Defect {
  defect_id: string;
  work_order_id: string;
  product_id: string;
  product_name: string;
  line_id: string;
  line_name: string;
  defect_type: string;
  defect_code: string;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  quantity_affected: number;
  detected_at: string;
  detected_by: string;
  root_cause: string | null;
  corrective_action: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  lot_number: string | null;
  serial_numbers: string[] | null;
}

export interface QualityHold {
  hold_id: string;
  product_id: string;
  product_name: string;
  lot_number: string;
  quantity: number;
  hold_type: 'inspection' | 'investigation' | 'quarantine' | 'customer_complaint';
  reason: string;
  location: string;
  placed_at: string;
  placed_by: string;
  status: 'active' | 'released' | 'scrapped' | 'reworked';
  expected_disposition_date: string;
  related_defect_id: string | null;
  notes: string;
}

export interface InspectionResult {
  inspection_id: string;
  work_order_id: string;
  product_id: string;
  product_name: string;
  inspection_type: 'incoming' | 'in_process' | 'final' | 'random';
  inspector_id: string;
  inspector_name: string;
  inspected_at: string;
  lot_number: string;
  sample_size: number;
  passed_count: number;
  failed_count: number;
  result: 'pass' | 'fail' | 'conditional';
  measurements: {
    parameter: string;
    specification: string;
    actual_value: string;
    status: 'pass' | 'fail';
  }[];
  notes: string | null;
  disposition: string | null;
}

export interface QualityConfig {
  baseUrl: string;
  apiKey: string;
  siteId: string;
}

class QualityConnector {
  private config: QualityConfig;
  private client: AxiosInstance;
  private initialized = false;

  constructor(config: QualityConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Site-ID': config.siteId
      },
      timeout: 30000
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing Quality connector', {
      baseUrl: this.config.baseUrl,
      siteId: this.config.siteId
    });

    try {
      await this.client.get('/api/v1/health');
      this.initialized = true;
      logger.info('Quality connector initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Quality connector', { error });
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getQualityMetrics(params?: {
    period?: 'today' | 'week' | 'month';
    line_id?: string;
  }): Promise<QualityMetrics> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting quality metrics', params);

    try {
      const response = await this.client.get('/api/v1/quality/metrics', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get quality metrics', { error });
      return this.getMockQualityMetrics(params);
    }
  }

  async getRecentDefects(params?: {
    limit?: number;
    severity?: string;
    status?: string;
  }): Promise<{
    defects: Defect[];
    total_count: number;
    summary: {
      open: number;
      investigating: number;
      critical: number;
      major: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting recent defects', params);

    try {
      const response = await this.client.get('/api/v1/quality/defects', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get recent defects', { error });
      return this.getMockRecentDefects(params);
    }
  }

  async getQualityHolds(): Promise<{
    holds: QualityHold[];
    summary: {
      total_active: number;
      total_quantity: number;
      inspection: number;
      investigation: number;
      quarantine: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting quality holds');

    try {
      const response = await this.client.get('/api/v1/quality/holds');
      return response.data;
    } catch (error) {
      logger.error('Failed to get quality holds', { error });
      return this.getMockQualityHolds();
    }
  }

  async getInspectionResults(params?: {
    limit?: number;
    type?: string;
    result?: string;
  }): Promise<{
    inspections: InspectionResult[];
    summary: {
      total_inspections: number;
      pass_rate: number;
      fail_rate: number;
      total_samples: number;
    };
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Getting inspection results', params);

    try {
      const response = await this.client.get('/api/v1/quality/inspections', { params });
      return response.data;
    } catch (error) {
      logger.error('Failed to get inspection results', { error });
      return this.getMockInspectionResults(params);
    }
  }

  // Mock data methods
  private getMockQualityMetrics(params?: { period?: string; line_id?: string }): QualityMetrics {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    return {
      period: params?.period || 'today',
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
      first_pass_yield: 96.8,
      overall_defect_rate: 1.2,
      scrap_rate: 0.4,
      rework_rate: 0.8,
      customer_returns_rate: 0.05,
      total_units_inspected: 2450,
      total_defects: 29,
      defects_by_type: [
        { type: 'Dimensional', count: 12, percentage: 41.4 },
        { type: 'Cosmetic', count: 8, percentage: 27.6 },
        { type: 'Assembly', count: 5, percentage: 17.2 },
        { type: 'Electrical', count: 3, percentage: 10.3 },
        { type: 'Material', count: 1, percentage: 3.4 }
      ],
      defects_by_line: [
        { line_id: 'LINE-001', line_name: 'Assembly Line 1', defect_count: 15, defect_rate: 1.5 },
        { line_id: 'LINE-002', line_name: 'Assembly Line 2', defect_count: 8, defect_rate: 1.0 },
        { line_id: 'LINE-004', line_name: 'CNC Machining Center', defect_count: 6, defect_rate: 1.1 }
      ]
    };
  }

  private getMockRecentDefects(params?: { limit?: number; severity?: string; status?: string }) {
    const defects: Defect[] = [
      {
        defect_id: 'DEF-2024-0156',
        work_order_id: 'WO-2024-0001',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A',
        line_id: 'LINE-001',
        line_name: 'Assembly Line 1',
        defect_type: 'Dimensional',
        defect_code: 'DIM-001',
        severity: 'major',
        description: 'Outer diameter out of tolerance (+0.05mm)',
        quantity_affected: 12,
        detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        detected_by: 'John Smith',
        root_cause: 'Tool wear on CNC lathe',
        corrective_action: 'Replaced worn tool, adjusted offset',
        status: 'resolved',
        lot_number: 'LOT-2024-0892',
        serial_numbers: null
      },
      {
        defect_id: 'DEF-2024-0155',
        work_order_id: 'WO-2024-0001',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A',
        line_id: 'LINE-001',
        line_name: 'Assembly Line 1',
        defect_type: 'Cosmetic',
        defect_code: 'COS-003',
        severity: 'minor',
        description: 'Surface scratch on housing',
        quantity_affected: 5,
        detected_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        detected_by: 'Maria Garcia',
        root_cause: null,
        corrective_action: null,
        status: 'investigating',
        lot_number: 'LOT-2024-0892',
        serial_numbers: ['SN-001245', 'SN-001246', 'SN-001247', 'SN-001248', 'SN-001249']
      },
      {
        defect_id: 'DEF-2024-0154',
        work_order_id: 'WO-2024-0002',
        product_id: 'PROD-B5678',
        product_name: 'Component B Assembly',
        line_id: 'LINE-002',
        line_name: 'Assembly Line 2',
        defect_type: 'Electrical',
        defect_code: 'ELE-002',
        severity: 'critical',
        description: 'Short circuit detected in PCB assembly',
        quantity_affected: 3,
        detected_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        detected_by: 'Robert Chen',
        root_cause: 'Solder bridge between pins',
        corrective_action: 'Rework by removing solder bridge, added to inspection checklist',
        status: 'resolved',
        lot_number: 'LOT-2024-0891',
        serial_numbers: ['SN-002345', 'SN-002346', 'SN-002347']
      },
      {
        defect_id: 'DEF-2024-0153',
        work_order_id: 'WO-2024-0003',
        product_id: 'PROD-C9012',
        product_name: 'Premium Widget C',
        line_id: 'LINE-001',
        line_name: 'Assembly Line 1',
        defect_type: 'Assembly',
        defect_code: 'ASM-001',
        severity: 'major',
        description: 'Missing fastener in final assembly',
        quantity_affected: 8,
        detected_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        detected_by: 'Sarah Johnson',
        root_cause: null,
        corrective_action: null,
        status: 'open',
        lot_number: 'LOT-2024-0885',
        serial_numbers: null
      }
    ];

    let filtered = defects;
    if (params?.severity) {
      filtered = filtered.filter(d => d.severity === params.severity);
    }
    if (params?.status) {
      filtered = filtered.filter(d => d.status === params.status);
    }
    if (params?.limit) {
      filtered = filtered.slice(0, params.limit);
    }

    return {
      defects: filtered,
      total_count: filtered.length,
      summary: {
        open: filtered.filter(d => d.status === 'open').length,
        investigating: filtered.filter(d => d.status === 'investigating').length,
        critical: filtered.filter(d => d.severity === 'critical').length,
        major: filtered.filter(d => d.severity === 'major').length
      }
    };
  }

  private getMockQualityHolds() {
    const holds: QualityHold[] = [
      {
        hold_id: 'HOLD-2024-0045',
        product_id: 'PROD-C9012',
        product_name: 'Premium Widget C',
        lot_number: 'LOT-2024-0885',
        quantity: 150,
        hold_type: 'investigation',
        reason: 'Missing fastener defects detected - root cause investigation in progress',
        location: 'Quality Hold Area, Bay 2',
        placed_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        placed_by: 'QC Manager',
        status: 'active',
        expected_disposition_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        related_defect_id: 'DEF-2024-0153',
        notes: 'Awaiting engineering review for disposition decision'
      },
      {
        hold_id: 'HOLD-2024-0044',
        product_id: 'PROD-D3456',
        product_name: 'Standard Part D',
        lot_number: 'LOT-2024-0878',
        quantity: 500,
        hold_type: 'quarantine',
        reason: 'Supplier material certification pending verification',
        location: 'Receiving Quarantine Area',
        placed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        placed_by: 'Receiving Inspector',
        status: 'active',
        expected_disposition_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        related_defect_id: null,
        notes: 'Contacted supplier for updated certification documents'
      },
      {
        hold_id: 'HOLD-2024-0043',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A',
        lot_number: 'LOT-2024-0890',
        quantity: 75,
        hold_type: 'inspection',
        reason: 'First article inspection required for new tooling',
        location: 'QC Lab',
        placed_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        placed_by: 'Production Supervisor',
        status: 'active',
        expected_disposition_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        related_defect_id: null,
        notes: 'FAI in progress, 80% complete'
      }
    ];

    return {
      holds,
      summary: {
        total_active: holds.filter(h => h.status === 'active').length,
        total_quantity: holds.filter(h => h.status === 'active').reduce((sum, h) => sum + h.quantity, 0),
        inspection: holds.filter(h => h.hold_type === 'inspection' && h.status === 'active').length,
        investigation: holds.filter(h => h.hold_type === 'investigation' && h.status === 'active').length,
        quarantine: holds.filter(h => h.hold_type === 'quarantine' && h.status === 'active').length
      }
    };
  }

  private getMockInspectionResults(params?: { limit?: number; type?: string; result?: string }) {
    const inspections: InspectionResult[] = [
      {
        inspection_id: 'INS-2024-0892',
        work_order_id: 'WO-2024-0001',
        product_id: 'PROD-A1234',
        product_name: 'Widget Assembly A',
        inspection_type: 'in_process',
        inspector_id: 'EMP-045',
        inspector_name: 'John Smith',
        inspected_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        lot_number: 'LOT-2024-0892',
        sample_size: 25,
        passed_count: 24,
        failed_count: 1,
        result: 'pass',
        measurements: [
          { parameter: 'Outer Diameter', specification: '25.0 +/- 0.1 mm', actual_value: '25.02 mm', status: 'pass' },
          { parameter: 'Length', specification: '100.0 +/- 0.2 mm', actual_value: '100.05 mm', status: 'pass' },
          { parameter: 'Surface Finish', specification: 'Ra <= 1.6 um', actual_value: 'Ra 1.2 um', status: 'pass' }
        ],
        notes: '1 unit failed dimensional check, segregated for rework',
        disposition: 'Accept with deviation noted'
      },
      {
        inspection_id: 'INS-2024-0891',
        work_order_id: 'WO-2024-0002',
        product_id: 'PROD-B5678',
        product_name: 'Component B Assembly',
        inspection_type: 'final',
        inspector_id: 'EMP-032',
        inspector_name: 'Maria Garcia',
        inspected_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        lot_number: 'LOT-2024-0891',
        sample_size: 50,
        passed_count: 50,
        failed_count: 0,
        result: 'pass',
        measurements: [
          { parameter: 'Electrical Test', specification: 'Resistance 100-120 ohms', actual_value: '108 ohms', status: 'pass' },
          { parameter: 'Visual Inspection', specification: 'No visible defects', actual_value: 'Pass', status: 'pass' },
          { parameter: 'Functional Test', specification: 'All functions operational', actual_value: 'Pass', status: 'pass' }
        ],
        notes: null,
        disposition: 'Released to finished goods'
      },
      {
        inspection_id: 'INS-2024-0890',
        work_order_id: 'WO-2024-0003',
        product_id: 'PROD-C9012',
        product_name: 'Premium Widget C',
        inspection_type: 'in_process',
        inspector_id: 'EMP-045',
        inspector_name: 'John Smith',
        inspected_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        lot_number: 'LOT-2024-0885',
        sample_size: 20,
        passed_count: 12,
        failed_count: 8,
        result: 'fail',
        measurements: [
          { parameter: 'Assembly Completeness', specification: 'All fasteners installed', actual_value: 'Missing fasteners', status: 'fail' },
          { parameter: 'Torque Check', specification: '5.0 +/- 0.5 Nm', actual_value: 'N/A - missing fasteners', status: 'fail' },
          { parameter: 'Visual Inspection', specification: 'No visible defects', actual_value: 'Pass', status: 'pass' }
        ],
        notes: '8 units failed assembly completeness check - missing fasteners',
        disposition: 'Placed on quality hold for investigation'
      },
      {
        inspection_id: 'INS-2024-0889',
        work_order_id: null as unknown as string,
        product_id: 'MAT-003',
        product_name: 'Electronic Component XR-42',
        inspection_type: 'incoming',
        inspector_id: 'EMP-028',
        inspector_name: 'Robert Chen',
        inspected_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        lot_number: 'LOT-SUP-2024-5678',
        sample_size: 100,
        passed_count: 100,
        failed_count: 0,
        result: 'pass',
        measurements: [
          { parameter: 'Electrical Characteristics', specification: 'Per datasheet', actual_value: 'Within spec', status: 'pass' },
          { parameter: 'Visual Inspection', specification: 'No damage or contamination', actual_value: 'Pass', status: 'pass' },
          { parameter: 'Quantity Verification', specification: '1000 units', actual_value: '1000 units', status: 'pass' }
        ],
        notes: null,
        disposition: 'Released to inventory'
      }
    ];

    let filtered = inspections;
    if (params?.type) {
      filtered = filtered.filter(i => i.inspection_type === params.type);
    }
    if (params?.result) {
      filtered = filtered.filter(i => i.result === params.result);
    }
    if (params?.limit) {
      filtered = filtered.slice(0, params.limit);
    }

    const totalSamples = filtered.reduce((sum, i) => sum + i.sample_size, 0);
    const totalPassed = filtered.reduce((sum, i) => sum + i.passed_count, 0);

    return {
      inspections: filtered,
      summary: {
        total_inspections: filtered.length,
        pass_rate: totalSamples > 0 ? (totalPassed / totalSamples) * 100 : 0,
        fail_rate: totalSamples > 0 ? ((totalSamples - totalPassed) / totalSamples) * 100 : 0,
        total_samples: totalSamples
      }
    };
  }

  getConfig(): { baseUrl: string; siteId: string } {
    return {
      baseUrl: this.config.baseUrl,
      siteId: this.config.siteId
    };
  }

  async close(): Promise<void> {
    logger.info('Closing Quality connector');
    this.initialized = false;
  }
}

// Singleton instance
let connector: QualityConnector | null = null;

export function getQualityConnector(): QualityConnector {
  if (!connector) {
    const config: QualityConfig = {
      baseUrl: process.env.QUALITY_BASE_URL || 'http://localhost:8082',
      apiKey: process.env.QUALITY_API_KEY || '',
      siteId: process.env.QUALITY_SITE_ID || 'SITE-001'
    };
    connector = new QualityConnector(config);
  }
  return connector;
}

export function resetQualityConnector(): void {
  if (connector) {
    connector.close();
    connector = null;
  }
}

export default QualityConnector;
