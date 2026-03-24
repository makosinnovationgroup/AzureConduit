import axios, { AxiosInstance } from 'axios';

/**
 * HR System Connector
 * Supports BambooHR, Workday, or a generic HR API
 */

export type HRSystemType = 'bamboohr' | 'workday' | 'generic';

export interface HRConfig {
  type: HRSystemType;
  baseUrl: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  companyDomain?: string; // For BambooHR
  tenantId?: string; // For Workday
}

export interface HREmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  workEmail: string;
  jobTitle: string;
  department: string;
  division?: string;
  location?: string;
  hireDate: string;
  startDate?: string;
  terminationDate?: string;
  employmentStatus: 'active' | 'inactive' | 'terminated' | 'onLeave';
  employmentType: 'fullTime' | 'partTime' | 'contractor' | 'intern';
  managerId?: string;
  managerEmail?: string;
  managerName?: string;
  compensation?: {
    salary?: number;
    currency?: string;
    payFrequency?: string;
  };
  ptoBalance?: {
    vacation?: number;
    sick?: number;
    personal?: number;
  };
  customFields?: Record<string, unknown>;
}

export interface DirectReport {
  id: string;
  employeeNumber: string;
  displayName: string;
  email: string;
  jobTitle: string;
  department: string;
}

export interface TeamMember {
  id: string;
  employeeNumber: string;
  displayName: string;
  email: string;
  jobTitle: string;
  managerId?: string;
  managerName?: string;
}

class HRConnector {
  private config: HRConfig;
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: HRConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set up request interceptor for authentication
    this.client.interceptors.request.use(async (reqConfig) => {
      const token = await this.getAuthToken();
      if (token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      } else if (this.config.apiKey) {
        // BambooHR style API key auth
        reqConfig.headers.Authorization = `Basic ${Buffer.from(this.config.apiKey + ':x').toString('base64')}`;
      }
      return reqConfig;
    });
  }

  private async getAuthToken(): Promise<string | null> {
    if (this.config.type === 'bamboohr') {
      // BambooHR uses API key, not OAuth
      return null;
    }

    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // Obtain new token for OAuth-based systems (Workday, generic)
    if (this.config.clientId && this.config.clientSecret) {
      try {
        const tokenUrl = this.getTokenUrl();
        const response = await axios.post(tokenUrl, new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        this.accessToken = response.data.access_token;
        this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 60) * 1000);
        return this.accessToken;
      } catch (error) {
        console.error('Failed to obtain HR system access token:', error);
        throw error;
      }
    }

    return null;
  }

  private getTokenUrl(): string {
    switch (this.config.type) {
      case 'workday':
        return `${this.config.baseUrl}/oauth2/${this.config.tenantId}/token`;
      case 'generic':
      default:
        return `${this.config.baseUrl}/oauth/token`;
    }
  }

  async getEmployee(employeeIdOrEmail: string): Promise<HREmployee | null> {
    try {
      let endpoint: string;

      switch (this.config.type) {
        case 'bamboohr':
          // BambooHR uses employee ID in path
          const isEmail = employeeIdOrEmail.includes('@');
          if (isEmail) {
            // Search by email first
            const employees = await this.searchEmployees(employeeIdOrEmail);
            if (employees.length > 0) {
              return employees[0];
            }
            return null;
          }
          endpoint = `/v1/employees/${employeeIdOrEmail}?fields=all`;
          break;
        case 'workday':
          endpoint = `/workers/${employeeIdOrEmail}`;
          break;
        case 'generic':
        default:
          endpoint = `/employees/${employeeIdOrEmail}`;
      }

      const response = await this.client.get(endpoint);
      return this.normalizeEmployee(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async searchEmployees(query: string): Promise<HREmployee[]> {
    try {
      let endpoint: string;
      let params: Record<string, string> = {};

      switch (this.config.type) {
        case 'bamboohr':
          endpoint = '/v1/employees/directory';
          break;
        case 'workday':
          endpoint = '/workers';
          params = { search: query };
          break;
        case 'generic':
        default:
          endpoint = '/employees/search';
          params = { q: query };
      }

      const response = await this.client.get(endpoint, { params });
      const employees = this.extractEmployeeList(response.data);

      // Filter by query for systems that don't support server-side search
      if (this.config.type === 'bamboohr') {
        const lowerQuery = query.toLowerCase();
        return employees.filter(emp =>
          emp.displayName.toLowerCase().includes(lowerQuery) ||
          emp.email.toLowerCase().includes(lowerQuery) ||
          emp.department.toLowerCase().includes(lowerQuery)
        );
      }

      return employees;
    } catch (error) {
      console.error('Failed to search employees:', error);
      throw error;
    }
  }

  async getDirectReports(managerIdOrEmail: string): Promise<DirectReport[]> {
    try {
      let endpoint: string;

      switch (this.config.type) {
        case 'bamboohr':
          endpoint = `/v1/employees/directory`;
          break;
        case 'workday':
          endpoint = `/workers/${managerIdOrEmail}/directReports`;
          break;
        case 'generic':
        default:
          endpoint = `/employees/${managerIdOrEmail}/direct-reports`;
      }

      const response = await this.client.get(endpoint);

      if (this.config.type === 'bamboohr') {
        // Filter employees by manager
        const employees = this.extractEmployeeList(response.data);
        const manager = employees.find(emp =>
          emp.id === managerIdOrEmail || emp.email === managerIdOrEmail
        );
        if (!manager) {
          return [];
        }
        return employees
          .filter(emp => emp.managerId === manager.id || emp.managerEmail === manager.email)
          .map(emp => ({
            id: emp.id,
            employeeNumber: emp.employeeNumber,
            displayName: emp.displayName,
            email: emp.email,
            jobTitle: emp.jobTitle,
            department: emp.department,
          }));
      }

      return this.extractDirectReports(response.data);
    } catch (error) {
      console.error('Failed to get direct reports:', error);
      throw error;
    }
  }

  async getTeamMembers(departmentOrManagerId: string): Promise<TeamMember[]> {
    try {
      let endpoint: string;

      switch (this.config.type) {
        case 'bamboohr':
          endpoint = '/v1/employees/directory';
          break;
        case 'workday':
          endpoint = '/workers';
          break;
        case 'generic':
        default:
          endpoint = '/employees';
      }

      const response = await this.client.get(endpoint);
      const employees = this.extractEmployeeList(response.data);

      // Filter by department
      return employees
        .filter(emp =>
          emp.department.toLowerCase() === departmentOrManagerId.toLowerCase() ||
          emp.managerId === departmentOrManagerId ||
          emp.managerEmail === departmentOrManagerId
        )
        .map(emp => ({
          id: emp.id,
          employeeNumber: emp.employeeNumber,
          displayName: emp.displayName,
          email: emp.email,
          jobTitle: emp.jobTitle,
          managerId: emp.managerId,
          managerName: emp.managerName,
        }));
    } catch (error) {
      console.error('Failed to get team members:', error);
      throw error;
    }
  }

  async getPTOBalance(employeeId: string): Promise<HREmployee['ptoBalance']> {
    try {
      let endpoint: string;

      switch (this.config.type) {
        case 'bamboohr':
          endpoint = `/v1/employees/${employeeId}/time_off/calculator`;
          break;
        case 'workday':
          endpoint = `/workers/${employeeId}/timeOff/balance`;
          break;
        case 'generic':
        default:
          endpoint = `/employees/${employeeId}/pto-balance`;
      }

      const response = await this.client.get(endpoint);
      return this.normalizePTOBalance(response.data);
    } catch (error) {
      console.error('Failed to get PTO balance:', error);
      // Return empty balance on error
      return { vacation: 0, sick: 0, personal: 0 };
    }
  }

  private normalizeEmployee(data: Record<string, unknown>): HREmployee {
    // Normalize employee data from different HR systems
    switch (this.config.type) {
      case 'bamboohr':
        return this.normalizeBambooHREmployee(data);
      case 'workday':
        return this.normalizeWorkdayEmployee(data);
      case 'generic':
      default:
        return this.normalizeGenericEmployee(data);
    }
  }

  private normalizeBambooHREmployee(data: Record<string, unknown>): HREmployee {
    return {
      id: String(data.id || ''),
      employeeNumber: String(data.employeeNumber || ''),
      firstName: String(data.firstName || ''),
      lastName: String(data.lastName || ''),
      displayName: `${data.firstName} ${data.lastName}`,
      email: String(data.workEmail || data.email || ''),
      workEmail: String(data.workEmail || data.email || ''),
      jobTitle: String(data.jobTitle || ''),
      department: String(data.department || ''),
      division: data.division as string | undefined,
      location: data.location as string | undefined,
      hireDate: String(data.hireDate || ''),
      startDate: data.originalHireDate as string | undefined,
      terminationDate: data.terminationDate as string | undefined,
      employmentStatus: this.normalizeStatus(String(data.status || 'active')),
      employmentType: this.normalizeType(String(data.employmentHistoryStatus || 'fullTime')),
      managerId: data.supervisorId as string | undefined,
      managerEmail: data.supervisorEmail as string | undefined,
      managerName: `${data.supervisorFirstName || ''} ${data.supervisorLastName || ''}`.trim() || undefined,
    };
  }

  private normalizeWorkdayEmployee(data: Record<string, unknown>): HREmployee {
    const worker = data.worker as Record<string, unknown> || data;
    const position = (worker.primaryPosition || worker.position || {}) as Record<string, unknown>;
    const manager = (worker.manager || {}) as Record<string, unknown>;

    return {
      id: String(worker.workerId || worker.id || ''),
      employeeNumber: String(worker.employeeID || worker.employeeNumber || ''),
      firstName: String(worker.firstName || worker.givenName || ''),
      lastName: String(worker.lastName || worker.familyName || ''),
      displayName: String(worker.displayName || `${worker.firstName} ${worker.lastName}`),
      email: String(worker.email || worker.primaryWorkEmail || ''),
      workEmail: String(worker.primaryWorkEmail || worker.email || ''),
      jobTitle: String(position.jobTitle || position.title || ''),
      department: String(position.department || position.organizationUnit || ''),
      division: position.division as string | undefined,
      location: String(position.location || worker.location || ''),
      hireDate: String(worker.hireDate || worker.originalHireDate || ''),
      employmentStatus: this.normalizeStatus(String(worker.employmentStatus || 'active')),
      employmentType: this.normalizeType(String(worker.workerType || 'fullTime')),
      managerId: manager.workerId as string | undefined,
      managerEmail: manager.email as string | undefined,
      managerName: manager.displayName as string | undefined,
    };
  }

  private normalizeGenericEmployee(data: Record<string, unknown>): HREmployee {
    return {
      id: String(data.id || data.employeeId || ''),
      employeeNumber: String(data.employeeNumber || data.employee_number || ''),
      firstName: String(data.firstName || data.first_name || ''),
      lastName: String(data.lastName || data.last_name || ''),
      displayName: String(data.displayName || data.display_name || `${data.firstName} ${data.lastName}`),
      email: String(data.email || data.workEmail || ''),
      workEmail: String(data.workEmail || data.work_email || data.email || ''),
      jobTitle: String(data.jobTitle || data.job_title || data.title || ''),
      department: String(data.department || ''),
      division: (data.division || data.business_unit) as string | undefined,
      location: (data.location || data.office) as string | undefined,
      hireDate: String(data.hireDate || data.hire_date || data.start_date || ''),
      startDate: (data.startDate || data.start_date) as string | undefined,
      terminationDate: (data.terminationDate || data.termination_date) as string | undefined,
      employmentStatus: this.normalizeStatus(String(data.status || data.employment_status || 'active')),
      employmentType: this.normalizeType(String(data.employmentType || data.employment_type || 'fullTime')),
      managerId: (data.managerId || data.manager_id || data.supervisor_id) as string | undefined,
      managerEmail: (data.managerEmail || data.manager_email) as string | undefined,
      managerName: (data.managerName || data.manager_name) as string | undefined,
    };
  }

  private normalizeStatus(status: string): HREmployee['employmentStatus'] {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('inactive') || lowerStatus.includes('disabled')) return 'inactive';
    if (lowerStatus.includes('terminated') || lowerStatus.includes('term')) return 'terminated';
    if (lowerStatus.includes('leave') || lowerStatus.includes('loa')) return 'onLeave';
    return 'active';
  }

  private normalizeType(type: string): HREmployee['employmentType'] {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('part')) return 'partTime';
    if (lowerType.includes('contract')) return 'contractor';
    if (lowerType.includes('intern')) return 'intern';
    return 'fullTime';
  }

  private extractEmployeeList(data: unknown): HREmployee[] {
    let employees: Record<string, unknown>[] = [];

    if (Array.isArray(data)) {
      employees = data;
    } else if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      // Handle various response structures
      employees = (obj.employees || obj.workers || obj.data || obj.results || []) as Record<string, unknown>[];
    }

    return employees.map(emp => this.normalizeEmployee(emp));
  }

  private extractDirectReports(data: unknown): DirectReport[] {
    const employees = this.extractEmployeeList(data);
    return employees.map(emp => ({
      id: emp.id,
      employeeNumber: emp.employeeNumber,
      displayName: emp.displayName,
      email: emp.email,
      jobTitle: emp.jobTitle,
      department: emp.department,
    }));
  }

  private normalizePTOBalance(data: unknown): HREmployee['ptoBalance'] {
    if (typeof data !== 'object' || data === null) {
      return { vacation: 0, sick: 0, personal: 0 };
    }

    const obj = data as Record<string, unknown>;

    // Handle BambooHR format
    if (Array.isArray(obj.timeOffTypes)) {
      const balance: HREmployee['ptoBalance'] = {};
      for (const type of obj.timeOffTypes as Array<{name: string; balance?: number}>) {
        const name = type.name?.toLowerCase() || '';
        if (name.includes('vacation') || name.includes('pto')) {
          balance.vacation = type.balance || 0;
        } else if (name.includes('sick')) {
          balance.sick = type.balance || 0;
        } else if (name.includes('personal')) {
          balance.personal = type.balance || 0;
        }
      }
      return balance;
    }

    // Generic format
    return {
      vacation: (obj.vacation || obj.vacationBalance || obj.pto || 0) as number,
      sick: (obj.sick || obj.sickBalance || 0) as number,
      personal: (obj.personal || obj.personalBalance || 0) as number,
    };
  }
}

// Singleton instance
let hrConnector: HRConnector | null = null;

export function initializeHRConnector(config: HRConfig): HRConnector {
  hrConnector = new HRConnector(config);
  return hrConnector;
}

export function getHRConnector(): HRConnector {
  if (!hrConnector) {
    // Initialize with environment variables
    const config: HRConfig = {
      type: (process.env.HR_SYSTEM_TYPE as HRSystemType) || 'generic',
      baseUrl: process.env.HR_API_URL || 'https://api.bamboohr.com/api/gateway.php',
      apiKey: process.env.HR_API_KEY,
      clientId: process.env.HR_CLIENT_ID,
      clientSecret: process.env.HR_CLIENT_SECRET,
      companyDomain: process.env.HR_COMPANY_DOMAIN,
      tenantId: process.env.HR_TENANT_ID,
    };
    hrConnector = new HRConnector(config);
  }
  return hrConnector;
}

export function resetHRConnector(): void {
  hrConnector = null;
}

export default HRConnector;
