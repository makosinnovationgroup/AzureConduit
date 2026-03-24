# Patient Portal MCP Server

A HIPAA-compliant Model Context Protocol (MCP) server for healthcare patient portal integration. This server provides secure access to patient data through EHR systems (Epic, Cerner, or generic FHIR R4 servers).

## Table of Contents

- [Features](#features)
- [HIPAA Compliance](#hipaa-compliance)
- [Available Tools](#available-tools)
- [Setup](#setup)
- [Configuration](#configuration)
- [FHIR Integration](#fhir-integration)
- [Audit Requirements](#audit-requirements)
- [Security Considerations](#security-considerations)
- [Development](#development)

## Features

- **Patient Data Access**: Demographics, summaries, and patient search
- **Appointment Management**: View, search, and check available slots
- **Clinical Information**: Medications, allergies, visit history, lab results
- **Billing Integration**: Patient balances, claims, payment history
- **HIPAA-Compliant Audit Logging**: All PHI access is logged
- **Multiple EHR Support**: Epic, Cerner, or generic FHIR R4

## HIPAA Compliance

This server is designed with HIPAA compliance in mind. Key considerations:

### Technical Safeguards

1. **Access Controls**
   - All tools require valid patient identifiers
   - Search functionality is limited to prevent bulk data access
   - Minimum necessary principle applied to all data returns

2. **Audit Controls**
   - Every PHI access is logged with who, what, when, where, why
   - Audit logs include success and failure events
   - Log sanitization removes PHI from audit entries

3. **Transmission Security**
   - Designed for use behind TLS 1.2+ (configure via reverse proxy)
   - OAuth 2.0 / SMART on FHIR authentication
   - Security headers applied to all responses

4. **Data Integrity**
   - Read-only access to PHI
   - Input validation on all parameters
   - Error messages do not expose PHI

### Administrative Safeguards

1. **Audit Log Retention**
   - HIPAA requires 6-year retention
   - Configure external audit storage for production
   - Logs must be tamper-evident

2. **Access Management**
   - Implement authentication before production
   - Role-based access control recommended
   - Session timeout configuration available

### Additional Regulatory Notes

- **42 CFR Part 2**: Substance abuse treatment records require additional consent
- **State Laws**: Some states have stricter privacy requirements
- **PCI DSS**: Payment card data handled separately (last 4 digits only)

## Available Tools

### Patient Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_patient_summary` | Get patient demographics and summary | `patient_id` |
| `search_patients` | Search patients by name/MRN | `query`, `limit?` |

### Appointment Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_appointments` | List patient appointments | `patient_id`, `date_range?` |
| `get_appointment` | Get appointment details | `appointment_id` |
| `get_available_slots` | Find open appointment slots | `provider_id`, `date_range` |
| `get_upcoming_appointments` | Get next appointments | `patient_id`, `count?` |

### Clinical Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_medications` | Get patient medications | `patient_id`, `status?` |
| `get_allergies` | Get patient allergies | `patient_id` |
| `get_recent_visits` | Get visit summaries | `patient_id`, `limit?` |
| `get_lab_results` | Get lab results | `patient_id`, `limit?`, `test_type?` |

### Billing Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_patient_balance` | Get outstanding balance | `patient_id` |
| `get_recent_claims` | Get insurance claims | `patient_id`, `limit?`, `status?` |
| `get_payment_history` | Get payment history | `patient_id`, `limit?` |

## Setup

### Prerequisites

- Node.js 20+
- npm or yarn
- Access to a FHIR R4-compliant EHR system

### Installation

```bash
# Clone the repository
cd mcp-servers/patient-portal-mcp

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure your environment variables
# Edit .env with your EHR credentials

# Build the project
npm run build

# Start the server
npm start
```

### Docker

```bash
# Build the image
docker build -t patient-portal-mcp .

# Run the container
docker run -d \
  -p 8000:8000 \
  -e EHR_SYSTEM=generic_fhir \
  -e EHR_BASE_URL=https://fhir.example.com/r4 \
  -e EHR_CLIENT_ID=your_client_id \
  -e EHR_CLIENT_SECRET=your_client_secret \
  patient-portal-mcp
```

## Configuration

### EHR System

Set `EHR_SYSTEM` to one of:
- `epic` - Epic FHIR R4 API
- `cerner` - Cerner FHIR R4 API
- `generic_fhir` - Any FHIR R4-compliant server

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `EHR_BASE_URL` | FHIR R4 base URL |
| `EHR_CLIENT_ID` | OAuth 2.0 client ID |
| `EHR_CLIENT_SECRET` | OAuth 2.0 client secret |

See `.env.example` for all configuration options.

## FHIR Integration

### Supported FHIR Resources

This server interacts with the following FHIR R4 resources:

- **Patient** - Demographics and identification
- **Appointment** - Scheduling information
- **Encounter** - Visit records
- **MedicationRequest** - Medication orders
- **AllergyIntolerance** - Allergy records
- **Observation** - Lab results and vitals
- **DiagnosticReport** - Lab report summaries
- **Claim** - Insurance claims
- **Coverage** - Insurance coverage

### Epic Setup

1. Register your application in the Epic App Orchard
2. Configure SMART on FHIR backend authentication
3. Generate a private key for JWT assertion
4. Set `EHR_SYSTEM=epic` and configure Epic-specific variables

### Cerner Setup

1. Register your application in the Cerner Code Console
2. Configure system account authentication
3. Set `EHR_SYSTEM=cerner` and configure Cerner-specific variables

### Generic FHIR

For other FHIR R4 servers:
1. Ensure the server supports OAuth 2.0 client credentials
2. Set `EHR_SYSTEM=generic_fhir`
3. Configure the base URL and credentials

## Audit Requirements

### HIPAA Audit Log Format

Each audit log entry contains:

```json
{
  "auditId": "unique-audit-id",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "eventType": "PHI_ACCESS",
  "category": "PATIENT_RECORD",
  "userId": "user-id",
  "userRole": "clinician",
  "sessionId": "session-id",
  "clientIp": "192.168.1.1",
  "resourceType": "Patient",
  "resourceId": "patient-123",
  "patientId": "patient-123",
  "toolName": "get_patient_summary",
  "action": "get_patient_summary:PHI_ACCESS",
  "purposeOfUse": "TREATMENT",
  "outcome": "SUCCESS",
  "outcomeDescription": "Patient summary retrieved"
}
```

### Event Types

- `PHI_ACCESS` - Reading patient data
- `PHI_SEARCH` - Searching for patients
- `ACCESS_DENIED` - Unauthorized access attempt
- `LOGIN` / `LOGOUT` - Session events
- `SYSTEM_ERROR` - Technical failures

### Production Audit Storage

For production, configure audit logs to:
- SIEM system (Splunk, Sumo Logic, etc.)
- Immutable cloud storage (S3 with Object Lock, Azure Blob)
- Dedicated HIPAA-compliant audit service

## Security Considerations

### Network Security

1. **TLS Encryption**: Deploy behind a reverse proxy with TLS 1.2+
2. **Network Segmentation**: Isolate from public internet
3. **Firewall Rules**: Restrict access to authorized clients only

### Authentication (Implement Before Production)

The server includes placeholder code for authentication. Implement:
- OAuth 2.0 / OpenID Connect
- SAML 2.0
- API key validation
- JWT verification

### Additional Recommendations

1. Enable rate limiting to prevent abuse
2. Implement request signing for integrity
3. Use Web Application Firewall (WAF)
4. Regular security assessments
5. Penetration testing before go-live

## Development

### Running Locally

```bash
# Development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
patient-portal-mcp/
├── src/
│   ├── index.ts              # HTTP server entry point
│   ├── server.ts             # MCP server setup
│   ├── connectors/
│   │   ├── ehr.ts            # EHR FHIR connector
│   │   ├── scheduling.ts     # Appointment connector
│   │   └── billing.ts        # Billing connector
│   ├── middleware/
│   │   └── audit.ts          # HIPAA audit logging
│   └── tools/
│       ├── patient-tools.ts    # Patient demographics
│       ├── appointment-tools.ts # Scheduling tools
│       ├── clinical-tools.ts   # Clinical data tools
│       └── billing-tools.ts    # Billing tools
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
└── README.md
```

### Contributing

1. All changes must maintain HIPAA compliance
2. Add audit logging for any new PHI access
3. Include tests for new functionality
4. Update documentation as needed

## License

Proprietary - AzureConduit

## Disclaimer

This software is provided as a framework for healthcare integration. Organizations are responsible for:
- Completing a HIPAA risk assessment
- Implementing appropriate authentication/authorization
- Configuring audit log retention
- Ensuring compliance with applicable regulations
- Executing Business Associate Agreements (BAAs)
