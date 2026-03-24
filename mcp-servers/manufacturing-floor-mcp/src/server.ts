import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import logger from './utils/logger';
import { getMESConnector } from './connectors/mes';
import { getERPConnector } from './connectors/erp';
import { getQualityConnector } from './connectors/quality';

// Import production tools
import {
  productionToolDefinitions,
  getProductionStatus,
  getWorkOrderStatus,
  listWorkOrders,
  getProductionSchedule,
  getLineEfficiency,
  getWorkOrderStatusSchema,
  listWorkOrdersSchema,
  getProductionScheduleSchema,
  getLineEfficiencySchema
} from './tools/production-tools';

// Import inventory tools
import {
  inventoryToolDefinitions,
  getRawMaterialLevels,
  getWIPInventory,
  getFinishedGoods,
  getMaterialShortages
} from './tools/inventory-tools';

// Import quality tools
import {
  qualityToolDefinitions,
  getQualityMetrics,
  getRecentDefects,
  getQualityHolds,
  getInspectionResults,
  getQualityMetricsSchema,
  getRecentDefectsSchema,
  getInspectionResultsSchema
} from './tools/quality-tools';

// Import equipment tools
import {
  equipmentToolDefinitions,
  getEquipmentStatus,
  getDowntimeReport,
  getMaintenanceSchedule,
  getEquipmentStatusSchema,
  getDowntimeReportSchema,
  getMaintenanceScheduleSchema
} from './tools/equipment-tools';

// Combine all tool definitions
const allToolDefinitions = [
  ...productionToolDefinitions,
  ...inventoryToolDefinitions,
  ...qualityToolDefinitions,
  ...equipmentToolDefinitions
];

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'manufacturing-floor-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info('Listing available tools');
    return {
      tools: allToolDefinitions
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info('Tool called', { name, args });

    try {
      let result: unknown;

      switch (name) {
        // Production tools
        case 'get_production_status':
          result = await getProductionStatus();
          break;

        case 'get_work_order_status': {
          const params = getWorkOrderStatusSchema.parse(args);
          result = await getWorkOrderStatus(params);
          break;
        }

        case 'list_work_orders': {
          const params = listWorkOrdersSchema.parse(args);
          result = await listWorkOrders(params);
          break;
        }

        case 'get_production_schedule': {
          const params = getProductionScheduleSchema.parse(args);
          result = await getProductionSchedule(params);
          break;
        }

        case 'get_line_efficiency': {
          const params = getLineEfficiencySchema.parse(args);
          result = await getLineEfficiency(params);
          break;
        }

        // Inventory tools
        case 'get_raw_material_levels':
          result = await getRawMaterialLevels();
          break;

        case 'get_wip_inventory':
          result = await getWIPInventory();
          break;

        case 'get_finished_goods':
          result = await getFinishedGoods();
          break;

        case 'get_material_shortages':
          result = await getMaterialShortages();
          break;

        // Quality tools
        case 'get_quality_metrics': {
          const params = getQualityMetricsSchema.parse(args);
          result = await getQualityMetrics(params);
          break;
        }

        case 'get_recent_defects': {
          const params = getRecentDefectsSchema.parse(args);
          result = await getRecentDefects(params);
          break;
        }

        case 'get_quality_holds':
          result = await getQualityHolds();
          break;

        case 'get_inspection_results': {
          const params = getInspectionResultsSchema.parse(args);
          result = await getInspectionResults(params);
          break;
        }

        // Equipment tools
        case 'get_equipment_status': {
          const params = getEquipmentStatusSchema.parse(args);
          result = await getEquipmentStatus(params);
          break;
        }

        case 'get_downtime_report': {
          const params = getDowntimeReportSchema.parse(args);
          result = await getDowntimeReport(params);
          break;
        }

        case 'get_maintenance_schedule': {
          const params = getMaintenanceScheduleSchema.parse(args);
          result = await getMaintenanceSchedule(params);
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Tool execution failed', { name, error });

      const errorMessage = error instanceof z.ZodError
        ? `Validation error: ${error.errors.map(e => e.message).join(', ')}`
        : error instanceof Error
          ? error.message
          : 'Unknown error occurred';

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage })
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  // Initialize connectors
  try {
    const mesConnector = getMESConnector();
    await mesConnector.initialize();
    logger.info('MES connection established');
  } catch (error) {
    logger.error('Failed to establish MES connection', { error });
  }

  try {
    const erpConnector = getERPConnector();
    await erpConnector.initialize();
    logger.info('ERP connection established');
  } catch (error) {
    logger.error('Failed to establish ERP connection', { error });
  }

  try {
    const qualityConnector = getQualityConnector();
    await qualityConnector.initialize();
    logger.info('Quality system connection established');
  } catch (error) {
    logger.error('Failed to establish Quality system connection', { error });
  }

  await server.connect(transport);
  logger.info('MCP server started on stdio transport');
}
