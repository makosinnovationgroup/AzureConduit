# PRD: On-Behalf-Of (OBO) Flow Implementation for AzureConduit MCP Servers

**Version:** 1.0
**Status:** Draft
**Author:** AzureConduit Team
**Last Updated:** 2024

---

## Executive Summary

This PRD defines the implementation of OAuth 2.0 On-Behalf-Of (OBO) flow for AzureConduit MCP servers. OBO enables the MCP server to call downstream Microsoft APIs (Graph, Dynamics 365, Fabric, Azure) using the authenticated user's identity and permissions, ensuring that "Claude only sees what the user is allowed to see."

---

## Problem Statement

### Current State
The current AzureConduit infrastructure validates user tokens at the APIM gateway, then uses a **Managed Identity** to call downstream APIs. This means:
- All API calls use the same service principal identity
- User-specific RBAC is not enforced at the downstream API level
- The MCP server has standing access to resources, not user-scoped access

### Why Not Use Microsoft's Official MCP Servers?
Microsoft's official MCP servers (Azure MCP, D365 MCP, Fabric MCP, Dataverse MCP) do **NOT** implement OBO out of the box. They are designed to use:
1. **Managed Identity** — for self-hosted deployments (all users share same access)
2. **OAuth Identity Passthrough** — only available when using Microsoft Foundry Agent Service as the orchestration layer

For direct Claude-to-MCP connections with user-scoped access, **OBO must be implemented in custom MCP server code**.

### Alternative: OAuth Identity Passthrough (Foundry Only)
If the client is willing to use Microsoft Foundry Agent Service as the intermediary (instead of direct Claude-to-MCP), they can leverage OAuth Identity Passthrough:

| Aspect | OBO (Custom MCP) | OAuth Identity Passthrough (Foundry) |
|--------|------------------|--------------------------------------|
| **How it works** | MCP server exchanges user token for downstream token | Foundry stores user tokens per-user, passes to MCP |
| **Requires** | Custom MCP server code + client credentials | Microsoft Foundry Agent Service |
| **Works with Claude directly** | ✅ Yes | ❌ No — requires Foundry as intermediary |
| **Implementation effort** | Medium (code + Terraform changes) | Low (configuration only) |
| **Best for** | Direct Claude integration, full control | Clients already using Copilot Studio/Foundry |

See [Microsoft Foundry MCP documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/mcp/) for OAuth Identity Passthrough details.

### Desired State
The MCP server should exchange the user's token for a downstream API token that:
- Carries the user's identity (UPN, OID, groups)
- Is scoped to the downstream API (Graph, D365, etc.)
- Enforces the user's RBAC permissions
- Triggers Conditional Access policies on downstream resources

---

## Goals

1. **User-scoped data access**: Every downstream API call reflects the signed-in user's permissions
2. **No standing access**: MCP server cannot access data without a user's token
3. **Conditional Access propagation**: MFA/device compliance requirements flow through
4. **Audit trail**: All API calls attributable to specific users
5. **Minimal code changes**: Reusable OBO helper for all MCP servers

---

## Non-Goals

- Implementing OBO in APIM policies (OBO requires a confidential client, which must be the MCP server)
- Supporting service-to-service (app-only) tokens via OBO (OBO only works with user tokens)
- Caching tokens across users (security risk)

---

## Technical Design

### Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │────▶│    APIM     │────▶│ MCP Server  │────▶│ Microsoft   │
│  (Client)   │     │  (Gateway)  │     │   (OBO)     │     │    APIs     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │                   │
                           │ Validates         │ Exchanges         │ Enforces
                           │ Token A           │ Token A → B       │ User RBAC
                           │                   │                   │
                           ▼                   ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                    │  Entra ID   │     │  Entra ID   │     │  User's     │
                    │  (Issuer)   │     │  (Token     │     │  Data Only  │
                    │             │     │   Endpoint) │     │             │
                    └─────────────┘     └─────────────┘     └─────────────┘
```

### OBO Token Exchange Flow

1. **APIM receives request** with user's access token (Token A)
2. **APIM validates Token A** using `validate-azure-ad-token` policy
3. **APIM forwards Token A** to MCP server in `Authorization` header (policy change required)
4. **MCP server extracts Token A** from the request
5. **MCP server calls Entra token endpoint** with:
   ```
   POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token

   grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
   client_id={mcp-app-client-id}
   client_secret={mcp-app-client-secret}  // or client_assertion for cert auth
   assertion={Token A}
   scope={downstream-api-scope}  // e.g., https://graph.microsoft.com/.default
   requested_token_use=on_behalf_of
   ```
6. **Entra returns Token B** scoped to downstream API, with user's identity
7. **MCP server calls downstream API** with Token B
8. **Downstream API enforces user's RBAC** and returns data

### Required Infrastructure Changes

#### 1. APIM Policy Update
Change the inbound policy to **forward** the user token instead of stripping it:

```xml
<!-- CURRENT: Strips user token, uses MSI -->
<set-header name="Authorization" exists-action="delete" />
<authentication-managed-identity resource="..." />

<!-- NEW: Forward user token to MCP server -->
<set-header name="X-User-Token" exists-action="override">
  <value>@(context.Request.Headers.GetValueOrDefault("Authorization",""))</value>
</set-header>
```

#### 2. Entra App Registration Update
Add client credentials to the MCP app registration:

```hcl
# In entra.tf - add client secret or certificate
resource "azuread_application_password" "mcp" {
  application_id = azuread_application.mcp.id
  display_name   = "MCP Server OBO Secret"
  end_date       = timeadd(timestamp(), "8760h") # 1 year
}

# Store in Key Vault
resource "azurerm_key_vault_secret" "mcp_client_secret" {
  name         = "mcp-client-secret"
  value        = azuread_application_password.mcp.value
  key_vault_id = azurerm_key_vault.main.id
}
```

#### 3. API Permissions for Downstream APIs
Add delegated permissions to the MCP app registration:

```hcl
# In entra.tf - add required API permissions
resource "azuread_application_api_access" "graph" {
  application_id = azuread_application.mcp.id
  api_client_id  = "00000003-0000-0000-c000-000000000000" # Microsoft Graph

  scope_ids = [
    "e1fe6dd8-ba31-4d61-89e7-88639da4683d", # User.Read
    "06da0dbc-49e2-44d2-8312-53f166ab848a", # Directory.Read.All
    # Add more as needed
  ]
}
```

### MCP Server Code Implementation

#### OBO Helper Module (`src/auth/obo.ts`)

```typescript
import { ConfidentialClientApplication } from '@azure/msal-node';

interface OboConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string; // or clientCertificate
}

interface OboResult {
  accessToken: string;
  expiresOn: Date;
}

export class OboTokenProvider {
  private msalClient: ConfidentialClientApplication;
  private tokenCache: Map<string, OboResult> = new Map();

  constructor(config: OboConfig) {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        clientSecret: config.clientSecret,
      },
    });
  }

  /**
   * Exchange user's access token for a downstream API token via OBO
   * @param userToken - The user's access token (from Authorization header)
   * @param scopes - Scopes for the downstream API (e.g., ['https://graph.microsoft.com/.default'])
   */
  async getTokenOnBehalfOf(userToken: string, scopes: string[]): Promise<OboResult> {
    // Remove "Bearer " prefix if present
    const assertion = userToken.replace(/^Bearer\s+/i, '');

    // Cache key based on token hash + scopes (don't cache across users!)
    const cacheKey = this.hashToken(assertion) + scopes.join(',');
    const cached = this.tokenCache.get(cacheKey);

    if (cached && cached.expiresOn > new Date()) {
      return cached;
    }

    try {
      const result = await this.msalClient.acquireTokenOnBehalfOf({
        oboAssertion: assertion,
        scopes: scopes,
      });

      if (!result || !result.accessToken) {
        throw new Error('OBO token exchange failed - no token returned');
      }

      const oboResult: OboResult = {
        accessToken: result.accessToken,
        expiresOn: result.expiresOn || new Date(Date.now() + 3600000),
      };

      // Cache with 5-minute buffer before expiry
      const cacheExpiry = new Date(oboResult.expiresOn.getTime() - 300000);
      if (cacheExpiry > new Date()) {
        this.tokenCache.set(cacheKey, oboResult);
      }

      return oboResult;
    } catch (error: any) {
      // Handle interaction_required - user needs to re-authenticate
      if (error.errorCode === 'interaction_required') {
        throw new OboInteractionRequiredError(
          'User must re-authenticate to access this resource',
          error.claims
        );
      }
      throw error;
    }
  }

  private hashToken(token: string): string {
    // Simple hash for cache key - not for security
    return Buffer.from(token.slice(-32)).toString('base64');
  }
}

export class OboInteractionRequiredError extends Error {
  constructor(message: string, public claims?: string) {
    super(message);
    this.name = 'OboInteractionRequiredError';
  }
}
```

#### Using OBO in MCP Tools

```typescript
import { OboTokenProvider } from '../auth/obo';
import axios from 'axios';

const oboProvider = new OboTokenProvider({
  tenantId: process.env.AZURE_TENANT_ID!,
  clientId: process.env.AZURE_CLIENT_ID!,
  clientSecret: process.env.AZURE_CLIENT_SECRET!,
});

export async function getUserProfile(userToken: string) {
  // Get OBO token for Microsoft Graph
  const oboToken = await oboProvider.getTokenOnBehalfOf(
    userToken,
    ['https://graph.microsoft.com/.default']
  );

  // Call Graph API with user-scoped token
  const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${oboToken.accessToken}`,
    },
  });

  return response.data;
}

export async function getD365Data(userToken: string, entity: string) {
  // Get OBO token for Dynamics 365
  const oboToken = await oboProvider.getTokenOnBehalfOf(
    userToken,
    ['https://org.crm.dynamics.com/.default']
  );

  // Call D365 API with user-scoped token
  const response = await axios.get(
    `https://org.api.crm.dynamics.com/api/data/v9.2/${entity}`,
    {
      headers: {
        Authorization: `Bearer ${oboToken.accessToken}`,
      },
    }
  );

  return response.data;
}
```

### Error Handling

#### Conditional Access / Step-Up Authentication
When downstream APIs require additional authentication (MFA, device compliance), OBO returns `interaction_required`:

```typescript
try {
  const token = await oboProvider.getTokenOnBehalfOf(userToken, scopes);
} catch (error) {
  if (error instanceof OboInteractionRequiredError) {
    // Return 403 with WWW-Authenticate header per MCP spec
    return {
      statusCode: 403,
      headers: {
        'WWW-Authenticate': `Bearer error="insufficient_scope", error_description="${error.message}"`,
      },
      body: {
        error: 'interaction_required',
        error_description: 'Additional authentication required for this resource',
        claims: error.claims,
      },
    };
  }
  throw error;
}
```

#### Token Validation Errors
| Error | Cause | Action |
|-------|-------|--------|
| `invalid_grant` | User token expired or revoked | Return 401, user must re-authenticate |
| `interaction_required` | MFA or CA policy triggered | Return 403 with claims challenge |
| `invalid_scope` | Requested scope not granted | Check app registration permissions |
| `unauthorized_client` | App not configured for OBO | Verify client credentials |

---

## Security Considerations

### Token Handling
- **Never log tokens**: Access tokens must not appear in logs
- **Short-lived caching**: Cache OBO tokens for performance, but expire before token expiry
- **Per-user cache**: Never reuse tokens across users
- **Secure storage**: Client secrets must be in Key Vault, not environment variables

### Client Credentials
- **Prefer certificates over secrets**: Certificates are more secure and don't expire as frequently
- **Rotate regularly**: Secrets should rotate at least annually
- **Monitor usage**: Alert on unusual token exchange patterns

### Scope Minimization
- Request only necessary scopes for each downstream API
- Use `.default` scope to get all pre-consented permissions
- Don't request more permissions than the user has consented to

---

## Implementation Phases

### Phase 1: Infrastructure (Terraform)
- [ ] Update APIM policy to forward user token
- [ ] Add client secret/certificate to Entra app registration
- [ ] Store credentials in Key Vault
- [ ] Add API permissions for Graph (baseline)

### Phase 2: OBO Helper Module
- [ ] Create `@azureconduit/obo` package
- [ ] Implement MSAL-based token exchange
- [ ] Add caching with proper expiry
- [ ] Add error handling for interaction_required
- [ ] Write unit tests with mocked MSAL

### Phase 3: Update Example MCP Servers
- [ ] Update `hello-world-mcp` as reference implementation
- [ ] Update connectors in business system servers (Salesforce, etc.)
- [ ] Add OBO configuration to `.env.example` files
- [ ] Update READMEs with OBO setup instructions

### Phase 4: Documentation
- [ ] Add OBO architecture diagram to docs
- [ ] Document required API permissions per downstream API
- [ ] Add troubleshooting guide for common OBO errors
- [ ] Update security architecture document

---

## Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| `@azure/msal-node` | MSAL client for OBO token exchange | ^2.0.0 |
| `@azure/identity` | Alternative: DefaultAzureCredential (if using managed identity + OBO) | ^4.0.0 |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| OBO token exchange success rate | >99% | Application Insights |
| Token exchange latency (p95) | <500ms | Application Insights |
| interaction_required errors | <5% of requests | Log Analytics |
| Security incidents from token leakage | 0 | Security audit |

---

## Open Questions

1. **Certificate vs Secret**: Should we default to certificates for better security, or secrets for simpler setup?
   - *Recommendation*: Secrets for dev/test, certificates for production

2. **Multi-tenant support**: Should the OBO helper support multi-tenant apps?
   - *Recommendation*: Start with single-tenant, add multi-tenant in v2

3. **Token caching strategy**: Per-request vs per-session vs shared cache?
   - *Recommendation*: Per-request with short-lived in-memory cache (5 min max)

4. **Downstream API scope configuration**: Hardcoded vs configurable?
   - *Recommendation*: Configurable via environment variables

---

## Appendix

### A. MSAL OBO Configuration Reference

```typescript
// Full MSAL configuration for OBO
const msalConfig: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,

    // Option 1: Client Secret
    clientSecret: process.env.AZURE_CLIENT_SECRET,

    // Option 2: Client Certificate (preferred for production)
    // clientCertificate: {
    //   thumbprint: process.env.AZURE_CLIENT_CERTIFICATE_THUMBPRINT,
    //   privateKey: process.env.AZURE_CLIENT_CERTIFICATE_PRIVATE_KEY,
    // },
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        // Don't log tokens!
        if (!message.includes('access_token')) {
          console.log(`[MSAL ${level}] ${message}`);
        }
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Warning,
    },
  },
};
```

### B. Required API Permissions by Downstream Service

| Service | Permission | Type | Description |
|---------|------------|------|-------------|
| **Microsoft Graph** | User.Read | Delegated | Read user profile |
| **Microsoft Graph** | Mail.Read | Delegated | Read user's mail |
| **Microsoft Graph** | Files.Read | Delegated | Read user's files |
| **Dynamics 365** | user_impersonation | Delegated | Access D365 as user |
| **Azure Management** | user_impersonation | Delegated | Access Azure resources |
| **Microsoft Fabric** | Workspace.Read.All | Delegated | Read Fabric workspaces |

### C. Terraform Changes Summary

```hcl
# Changes needed in entra.tf:

# 1. Add client secret
resource "azuread_application_password" "mcp" { ... }

# 2. Store in Key Vault
resource "azurerm_key_vault_secret" "mcp_client_secret" { ... }

# 3. Add API permissions
resource "azuread_application_api_access" "graph" { ... }

# Changes needed in policies/apim_inbound.xml:

# 1. Forward user token instead of stripping
# 2. Remove MSI authentication for backend calls
```
