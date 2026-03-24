import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import logger from './utils/logger';
import { getFinanceConnector } from './connectors/finance';

// Import tool definitions and handlers
import {
  kpiToolDefinitions,
  getFinancialSummary,
  getKPIDashboard,
  comparePeriods,
  comparePeriodsSchema
} from './tools/kpi-tools';

import {
  arToolDefinitions,
  getARSummary,
  getARAging,
  getTopReceivables,
  getCollectionForecast,
  getTopReceivablesSchema,
  getCollectionForecastSchema
} from './tools/ar-tools';

import {
  apToolDefinitions,
  getAPSummary,
  getAPAging,
  getUpcomingPayments,
  getUpcomingPaymentsSchema
} from './tools/ap-tools';

import {
  cashToolDefinitions,
  getCashPosition,
  getCashFlowForecast,
  getCashRunway,
  getCashFlowForecastSchema
} from './tools/cash-tools';

import {
  budgetToolDefinitions,
  getBudgetVsActual,
  getVarianceReport,
  getDepartmentSpending,
  getBudgetVsActualSchema,
  getVarianceReportSchema,
  getDepartmentSpendingSchema
} from './tools/budget-tools';

import {
  revenueToolDefinitions,
  getRevenueTrend,
  getRevenueBySegment,
  getMRR,
  getRevenueTrendSchema
} from './tools/revenue-tools';

// Combine all tool definitions
const allToolDefinitions = [
  ...kpiToolDefinitions,
  ...arToolDefinitions,
  ...apToolDefinitions,
  ...cashToolDefinitions,
  ...budgetToolDefinitions,
  ...revenueToolDefinitions
];

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'finance-dashboard-mcp',
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
        // KPI Tools
        case 'get_financial_summary':
          result = await getFinancialSummary();
          break;

        case 'get_kpi_dashboard':
          result = await getKPIDashboard();
          break;

        case 'compare_periods': {
          const params = comparePeriodsSchema.parse(args);
          result = await comparePeriods(params);
          break;
        }

        // AR Tools
        case 'get_ar_summary':
          result = await getARSummary();
          break;

        case 'get_ar_aging':
          result = await getARAging();
          break;

        case 'get_top_receivables': {
          const params = getTopReceivablesSchema.parse(args);
          result = await getTopReceivables(params);
          break;
        }

        case 'get_collection_forecast': {
          const params = getCollectionForecastSchema.parse(args);
          result = await getCollectionForecast(params);
          break;
        }

        // AP Tools
        case 'get_ap_summary':
          result = await getAPSummary();
          break;

        case 'get_ap_aging':
          result = await getAPAging();
          break;

        case 'get_upcoming_payments': {
          const params = getUpcomingPaymentsSchema.parse(args);
          result = await getUpcomingPayments(params);
          break;
        }

        // Cash Tools
        case 'get_cash_position':
          result = await getCashPosition();
          break;

        case 'get_cash_flow_forecast': {
          const params = getCashFlowForecastSchema.parse(args);
          result = await getCashFlowForecast(params);
          break;
        }

        case 'get_cash_runway':
          result = await getCashRunway();
          break;

        // Budget Tools
        case 'get_budget_vs_actual': {
          const params = getBudgetVsActualSchema.parse(args);
          result = await getBudgetVsActual(params);
          break;
        }

        case 'get_variance_report': {
          const params = getVarianceReportSchema.parse(args);
          result = await getVarianceReport(params);
          break;
        }

        case 'get_department_spending': {
          const params = getDepartmentSpendingSchema.parse(args);
          result = await getDepartmentSpending(params);
          break;
        }

        // Revenue Tools
        case 'get_revenue_trend': {
          const params = getRevenueTrendSchema.parse(args);
          result = await getRevenueTrend(params);
          break;
        }

        case 'get_revenue_by_segment':
          result = await getRevenueBySegment();
          break;

        case 'get_mrr':
          result = await getMRR();
          break;

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

  // Initialize finance connector
  try {
    const connector = getFinanceConnector();
    await connector.initialize();
    logger.info('Finance connector initialized');
  } catch (error) {
    logger.error('Failed to initialize finance connector', { error });
    // Continue anyway - some tools may still work with mock data
  }

  await server.connect(transport);
  logger.info('MCP server started on stdio transport');
}
