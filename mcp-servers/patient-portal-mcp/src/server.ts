/**
 * Patient Portal MCP Server
 *
 * HIPAA-compliant MCP server for healthcare patient portal integration.
 *
 * HIPAA COMPLIANCE OVERVIEW:
 * - All PHI access is logged via audit middleware
 * - Tools implement minimum necessary principle
 * - Authentication and authorization required (implement in production)
 * - Encryption required for data in transit (TLS 1.2+)
 * - Access controls implemented per tool
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import auditLogger, { logAuditEvent } from './middleware/audit';
import { getEHRConnector } from './connectors/ehr';

// Import tool definitions and handlers
import {
  toolDefinitions as patientToolDefinitions,
  getPatientSummary,
  searchPatients,
  getPatientSummarySchema,
  searchPatientsSchema
} from './tools/patient-tools';

import {
  toolDefinitions as appointmentToolDefinitions,
  listAppointments,
  getAppointment,
  getAvailableSlots,
  getUpcomingAppointments,
  listAppointmentsSchema,
  getAppointmentSchema,
  getAvailableSlotsSchema,
  getUpcomingAppointmentsSchema
} from './tools/appointment-tools';

import {
  toolDefinitions as clinicalToolDefinitions,
  getMedications,
  getAllergies,
  getRecentVisits,
  getLabResults,
  getMedicationsSchema,
  getAllergiesSchema,
  getRecentVisitsSchema,
  getLabResultsSchema
} from './tools/clinical-tools';

import {
  toolDefinitions as billingToolDefinitions,
  getPatientBalance,
  getRecentClaims,
  getPaymentHistory,
  getPatientBalanceSchema,
  getRecentClaimsSchema,
  getPaymentHistorySchema
} from './tools/billing-tools';

// Combine all tool definitions
const allToolDefinitions = [
  ...patientToolDefinitions,
  ...appointmentToolDefinitions,
  ...clinicalToolDefinitions,
  ...billingToolDefinitions
];

/**
 * Create the MCP server instance
 *
 * HIPAA NOTE: This server handles Protected Health Information (PHI).
 * Ensure proper security controls are in place:
 * - Network encryption (TLS)
 * - Authentication
 * - Authorization
 * - Audit logging
 */
export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'patient-portal-mcp',
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
    auditLogger.info('Listing available tools', { action: 'list_tools' });
    return {
      tools: allToolDefinitions
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Log tool invocation (separate from PHI access logging)
    auditLogger.info('Tool invoked', {
      action: 'tool_call',
      toolName: name,
      // Don't log full args here - PHI logging is handled by individual tools
      hasArguments: !!args
    });

    try {
      let result: unknown;

      switch (name) {
        // Patient tools
        case 'get_patient_summary': {
          const params = getPatientSummarySchema.parse(args);
          result = await getPatientSummary(params);
          break;
        }

        case 'search_patients': {
          const params = searchPatientsSchema.parse(args);
          result = await searchPatients(params);
          break;
        }

        // Appointment tools
        case 'list_appointments': {
          const params = listAppointmentsSchema.parse(args);
          result = await listAppointments(params);
          break;
        }

        case 'get_appointment': {
          const params = getAppointmentSchema.parse(args);
          result = await getAppointment(params);
          break;
        }

        case 'get_available_slots': {
          const params = getAvailableSlotsSchema.parse(args);
          result = await getAvailableSlots(params);
          break;
        }

        case 'get_upcoming_appointments': {
          const params = getUpcomingAppointmentsSchema.parse(args);
          result = await getUpcomingAppointments(params);
          break;
        }

        // Clinical tools
        case 'get_medications': {
          const params = getMedicationsSchema.parse(args);
          result = await getMedications(params);
          break;
        }

        case 'get_allergies': {
          const params = getAllergiesSchema.parse(args);
          result = await getAllergies(params);
          break;
        }

        case 'get_recent_visits': {
          const params = getRecentVisitsSchema.parse(args);
          result = await getRecentVisits(params);
          break;
        }

        case 'get_lab_results': {
          const params = getLabResultsSchema.parse(args);
          result = await getLabResults(params);
          break;
        }

        // Billing tools
        case 'get_patient_balance': {
          const params = getPatientBalanceSchema.parse(args);
          result = await getPatientBalance(params);
          break;
        }

        case 'get_recent_claims': {
          const params = getRecentClaimsSchema.parse(args);
          result = await getRecentClaims(params);
          break;
        }

        case 'get_payment_history': {
          const params = getPaymentHistorySchema.parse(args);
          result = await getPaymentHistory(params);
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      // Log successful tool execution
      auditLogger.info('Tool executed successfully', {
        action: 'tool_success',
        toolName: name
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      // Log tool execution failure
      auditLogger.error('Tool execution failed', {
        action: 'tool_error',
        toolName: name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Log to HIPAA audit trail if this was a PHI access failure
      logAuditEvent(
        'SYSTEM_ERROR',
        {
          toolName: name,
          resourceType: 'PATIENT_RECORD',
          parameters: { error: error instanceof Error ? error.message : 'Unknown error' }
        },
        'FAILURE',
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      const errorMessage =
        error instanceof z.ZodError
          ? `Validation error: ${error.errors.map((e) => e.message).join(', ')}`
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

/**
 * Start the server with stdio transport
 * Used for CLI/local development
 */
export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  // Log server startup
  logAuditEvent(
    'LOGIN',
    {
      toolName: 'server',
      resourceType: 'AUTHENTICATION',
      purposeOfUse: 'SYSTEM'
    },
    'SUCCESS',
    'MCP server starting'
  );

  await server.connect(transport);

  auditLogger.info('Patient Portal MCP server started', {
    transport: 'stdio',
    version: '1.0.0'
  });
}

export default { createMcpServer, startStdioServer };
