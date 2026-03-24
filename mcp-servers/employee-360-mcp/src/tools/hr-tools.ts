import { z } from 'zod';
import { getHRConnector, HREmployee, DirectReport, TeamMember } from '../connectors/hr';

/**
 * HR Tools - Human Resources specific queries
 */

// Schema definitions
export const GetEmployeeHRSchema = z.object({
  employee_id: z.string().optional().describe('Employee ID from HR system'),
  email: z.string().email().optional().describe('Employee email address'),
}).refine(data => data.employee_id || data.email, {
  message: 'Either employee_id or email must be provided',
});

export const GetDirectReportsSchema = z.object({
  manager_id: z.string().optional().describe('Manager employee ID'),
  manager_email: z.string().email().optional().describe('Manager email address'),
}).refine(data => data.manager_id || data.manager_email, {
  message: 'Either manager_id or manager_email must be provided',
});

export const GetTeamMembersSchema = z.object({
  department: z.string().optional().describe('Department name to list members for'),
  manager_id: z.string().optional().describe('Manager ID to list team for'),
  manager_email: z.string().email().optional().describe('Manager email to list team for'),
}).refine(data => data.department || data.manager_id || data.manager_email, {
  message: 'Either department, manager_id, or manager_email must be provided',
});

// Types
export interface HRDetails {
  id: string;
  employeeNumber: string;
  displayName: string;
  email: string;
  jobTitle: string;
  department: string;
  division?: string;
  location?: string;
  hireDate: string;
  startDate?: string;
  employmentStatus: HREmployee['employmentStatus'];
  employmentType: HREmployee['employmentType'];
  manager?: {
    id?: string;
    name?: string;
    email?: string;
  };
  ptoBalance?: {
    vacation?: number;
    sick?: number;
    personal?: number;
  };
  tenure: {
    years: number;
    months: number;
    days: number;
    totalDays: number;
  };
}

// Helper function to calculate tenure
function calculateTenure(hireDate: string): HRDetails['tenure'] {
  const hire = new Date(hireDate);
  const now = new Date();

  if (isNaN(hire.getTime())) {
    return { years: 0, months: 0, days: 0, totalDays: 0 };
  }

  const totalDays = Math.floor((now.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24));
  const years = Math.floor(totalDays / 365);
  const remainingDays = totalDays % 365;
  const months = Math.floor(remainingDays / 30);
  const days = remainingDays % 30;

  return { years, months, days, totalDays };
}

// Tool implementations
export async function getEmployeeHR(
  params: z.infer<typeof GetEmployeeHRSchema>
): Promise<HRDetails | null> {
  const hrConnector = getHRConnector();
  const identifier = params.email || params.employee_id!;

  const employee = await hrConnector.getEmployee(identifier);

  if (!employee) {
    return null;
  }

  // Get PTO balance if not included
  let ptoBalance = employee.ptoBalance;
  if (!ptoBalance) {
    try {
      ptoBalance = await hrConnector.getPTOBalance(employee.id);
    } catch {
      // PTO lookup may fail for some employees
    }
  }

  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    displayName: employee.displayName,
    email: employee.email,
    jobTitle: employee.jobTitle,
    department: employee.department,
    division: employee.division,
    location: employee.location,
    hireDate: employee.hireDate,
    startDate: employee.startDate,
    employmentStatus: employee.employmentStatus,
    employmentType: employee.employmentType,
    manager: employee.managerId || employee.managerEmail || employee.managerName
      ? {
          id: employee.managerId,
          name: employee.managerName,
          email: employee.managerEmail,
        }
      : undefined,
    ptoBalance,
    tenure: calculateTenure(employee.hireDate),
  };
}

export async function getDirectReports(
  params: z.infer<typeof GetDirectReportsSchema>
): Promise<DirectReport[]> {
  const hrConnector = getHRConnector();
  const identifier = params.manager_email || params.manager_id!;

  return hrConnector.getDirectReports(identifier);
}

export async function getTeamMembers(
  params: z.infer<typeof GetTeamMembersSchema>
): Promise<TeamMember[]> {
  const hrConnector = getHRConnector();
  const identifier = params.department || params.manager_email || params.manager_id!;

  return hrConnector.getTeamMembers(identifier);
}

// Tool definitions for MCP registration
export const hrTools = [
  {
    name: 'get_employee_hr',
    description:
      'Get HR details for an employee including title, department, hire date, tenure, PTO balance, and manager information',
    inputSchema: {
      type: 'object' as const,
      properties: {
        employee_id: {
          type: 'string',
          description: 'Employee ID from the HR system',
        },
        email: {
          type: 'string',
          description: 'Employee email address',
        },
      },
    },
    handler: getEmployeeHR,
    schema: GetEmployeeHRSchema,
  },
  {
    name: 'get_direct_reports',
    description:
      'List all direct reports for a manager from the HR system',
    inputSchema: {
      type: 'object' as const,
      properties: {
        manager_id: {
          type: 'string',
          description: 'Manager employee ID',
        },
        manager_email: {
          type: 'string',
          description: 'Manager email address',
        },
      },
    },
    handler: getDirectReports,
    schema: GetDirectReportsSchema,
  },
  {
    name: 'get_team_members',
    description:
      'List all members of a team/department from the HR system',
    inputSchema: {
      type: 'object' as const,
      properties: {
        department: {
          type: 'string',
          description: 'Department name to list members for',
        },
        manager_id: {
          type: 'string',
          description: 'Manager ID to list team members for',
        },
        manager_email: {
          type: 'string',
          description: 'Manager email to list team members for',
        },
      },
    },
    handler: getTeamMembers,
    schema: GetTeamMembersSchema,
  },
];
