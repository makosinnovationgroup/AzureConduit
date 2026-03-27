# AzureConduit Security Architecture — Source Material for CTO Presentation

**Audience:** CTO at mid-to-large enterprise
**Purpose:** Technical credibility for security slide on AzureConduit MCP platform

---

## 1. Entra ID OAuth 2.1 / OIDC Flow for MCP Servers

### Plain English (for slide)
> "When Claude connects to your MCP server, it follows the OAuth 2.1 standard with PKCE protection. Your users authenticate directly with Microsoft — Claude never sees their password. The MCP server advertises its authentication requirements through a standard discovery endpoint, and Claude's browser handles the secure handshake."

### Technical Proof Points

**Initial Authentication Handshake:**
1. Claude (MCP client) makes an unauthenticated request to the MCP server
2. MCP server returns `HTTP 401 Unauthorized` with a `WWW-Authenticate` header containing the `resource_metadata` URL
3. Claude fetches the Protected Resource Metadata (PRM) document from `/.well-known/oauth-protected-resource`
4. PRM document contains `authorization_servers` field pointing to Entra ID
5. Claude discovers Entra's authorization endpoints via `/.well-known/openid-configuration`
6. User authenticates via browser redirect to Entra ID
7. Authorization code is exchanged for access token (with PKCE verification)
8. Claude presents Bearer token to MCP server on subsequent requests

**Protected Resource Metadata (PRM) — RFC 9728:**
- MCP servers MUST implement RFC 9728 to advertise their authorization server
- The `/.well-known/oauth-protected-resource` endpoint returns JSON with:
  - `authorization_servers`: Array of authorization server URLs (Entra ID)
  - `scopes_supported`: Available permission scopes
  - `resource`: Canonical URI of the MCP server
- This allows Claude to automatically discover how to authenticate without hardcoded configuration

**Dynamic Client Registration (DCR):**
- **Entra ID does NOT support RFC 7591 Dynamic Client Registration** natively
- This is a known gap — workarounds include:
  1. Pre-registered static client IDs (recommended for enterprise)
  2. Control plane/compatibility layer that exposes DCR endpoint and maps to Entra app registrations
  3. Client ID Metadata Documents (HTTPS URLs as client identifiers)
- For AzureConduit: Use a pre-registered Entra app registration for the MCP client

**PKCE Requirement:**
- MCP clients MUST implement PKCE (Proof Key for Code Exchange)
- MUST use `S256` code challenge method
- Prevents authorization code interception attacks

### Microsoft Documentation
- [Secure access to MCP servers in Azure API Management](https://learn.microsoft.com/en-us/azure/api-management/secure-mcp-servers)
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [RFC 9728 - OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [Entra ID DCR discussion (Microsoft Q&A)](https://learn.microsoft.com/en-us/answers/questions/5516363/does-entraid-has-a-plan-to-introduce-dynamic-clien)

---

## 2. On-Behalf-Of (OBO) Flow

### Plain English (for slide)
> "The MCP server never has standing access to your data. When a user asks Claude a question, the server exchanges their token for a downstream token that carries their identity and their permissions. Claude only sees what that specific user is allowed to see — nothing more."

> ⚠️ **Important Implementation Note:** OBO is NOT built into Microsoft's official MCP servers (Azure MCP, D365 MCP, Fabric MCP). These servers use Managed Identity by default, meaning all users share the same access level. OBO requires **custom MCP server code** — see `prds/OBO_IMPLEMENTATION.md` for implementation guide.

### Identity Options Comparison

| Approach | User-Scoped Access | Built-in | Requires |
|----------|-------------------|----------|----------|
| **Managed Identity** (default) | ❌ No — all users share same access | ✅ Yes | Nothing extra |
| **OBO Flow** | ✅ Yes — each user's permissions | ❌ No | Custom MCP server code |
| **OAuth Identity Passthrough** | ✅ Yes — each user's permissions | ✅ Yes (Foundry only) | Microsoft Foundry Agent Service |

### Technical Proof Points

**How OBO Token Exchange Works:**
1. User authenticates to Claude, receives Token A (audience = MCP server)
2. MCP server receives request with Token A
3. MCP server calls Entra's token endpoint with:
   - `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`
   - `assertion=<Token A>`
   - `scope=<downstream API scopes>` (e.g., `https://graph.microsoft.com/user.read`)
   - `requested_token_use=on_behalf_of`
4. Entra validates Token A and issues Token B (audience = downstream API like Graph or D365)
5. MCP server uses Token B to call downstream API
6. Downstream API enforces permissions based on the original user's identity

**Critical Security Properties:**
- **Roles stay with the user**: The OBO flow only uses delegated scopes, never application roles. Roles remain attached to the principal (the user), preventing privilege escalation.
- **User principal required**: OBO only works for user principals, not service principals. If a service principal sends an app-only token, OBO cannot be used.
- **Conditional Access propagates**: If downstream API requires MFA or device compliance, the OBO exchange returns an `interaction_required` error that surfaces to the user.

**"Claude only sees what the user is allowed to see":**
- Token B inherits the user's identity claims (`sub`, `oid`, `upn`)
- Downstream APIs (Graph, D365, Fabric) evaluate the user's RBAC roles and permissions
- The MCP server cannot request scopes the user hasn't consented to
- The MCP server cannot elevate permissions beyond what the user has

### Microsoft Documentation
- [Microsoft identity platform and OAuth2.0 On-Behalf-Of flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow)
- [Agent OAuth flows - On-behalf-of flow](https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-on-behalf-of-oauth-flow)

---

## 3. Azure RBAC in the MCP Context

### Plain English (for slide)
> "Every API call the MCP server makes is evaluated against your existing Azure role assignments. If a user doesn't have Reader access to a storage account in Azure, Claude can't read it either. Your existing security controls apply automatically."

### Technical Proof Points

**Multi-Layer Permission Enforcement:**
1. **Microsoft Graph Permissions**: App must have delegated permissions granted (e.g., `Files.Read`, `Mail.Read`)
2. **User's RBAC Roles**: User must have appropriate Azure RBAC roles for Azure resources
3. **Service-Specific Permissions**: D365 Security Roles, SharePoint permissions, etc.

**How RBAC Flows Through:**
- OBO token contains user's `oid` (object ID) and group memberships
- Azure Resource Manager evaluates role assignments for that `oid`
- D365 evaluates security roles assigned to that user
- Graph evaluates mailbox permissions, SharePoint access, etc.

**What Prevents Unauthorized Access:**
- Token audience validation: APIs reject tokens not issued for them
- Scope validation: APIs reject requests for ungranted scopes
- RBAC evaluation: Azure rejects requests where user lacks role assignment
- The MCP server cannot bypass any of these checks — it's using the user's identity

**Example Flow:**
```
User asks: "What's in my Azure storage account?"
1. MCP server exchanges token for Azure scope
2. Calls Azure Resource Manager with user's token
3. ARM checks: Does user have Reader role on this subscription/resource?
4. If yes → return data. If no → 403 Forbidden
5. Claude receives only what RBAC allows
```

### Microsoft Documentation
- [Overview of Microsoft Graph permissions](https://learn.microsoft.com/en-us/graph/permissions-overview)
- [Authentication and authorization basics - Microsoft Graph](https://learn.microsoft.com/en-us/graph/auth/auth-concepts)
- [Azure RBAC documentation](https://learn.microsoft.com/en-us/azure/role-based-access-control/overview)

---

## 4. Entra Conditional Access

### Plain English (for slide)
> "Your existing Conditional Access policies apply to MCP server access. Require MFA, compliant devices, or trusted locations — all enforced before any data reaches Claude. Configure it once in Entra ID, and it protects all your MCP-connected resources."

### Technical Proof Points

**What Conditional Access Policies Apply:**
- Any policy targeting the MCP server's app registration
- Any policy targeting "All cloud apps" or "All resources"
- Policies on downstream resources (Graph, D365) via OBO flow

**Enforceable Controls:**
| Control | Supported | How It Works |
|---------|-----------|--------------|
| **MFA** | ✅ Yes | User prompted during OAuth flow |
| **Device Compliance** | ✅ Yes | Requires Intune-managed, compliant device |
| **Hybrid Azure AD Join** | ✅ Yes | Requires domain-joined device |
| **Trusted Locations** | ✅ Yes | IP-based or named location restrictions |
| **Sign-in Risk** | ✅ Yes | Identity Protection risk evaluation |
| **App Protection Policies** | ✅ Yes | MAM policy enforcement |

**How to Configure CA for MCP Server:**
1. Go to **Entra ID → Conditional Access → Policies → New Policy**
2. Under **Target resources**, select your MCP server app registration
3. Configure conditions (users, locations, devices, risk levels)
4. Set grant controls (require MFA, compliant device, etc.)
5. Enable policy

**OBO and Conditional Access:**
- If downstream API has CA policy requiring additional controls, OBO returns `interaction_required` error
- Client must re-authenticate with claims challenge
- This ensures CA policies on downstream resources are enforced even through MCP

**Important Limitation:**
- Service principal calls (not user calls) bypass user-scoped CA policies
- Use "Conditional Access for workload identities" for service principal scenarios

### Microsoft Documentation
- [Targeting Resources in Conditional Access Policies](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-cloud-apps)
- [Build Conditional Access policies](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-policies)
- [Require MFA for all users](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-mfa-strength)

---

## 5. Token Handling and Security Boundaries

### Plain English (for slide)
> "Tokens are short-lived and never leave your security boundary. APIM validates tokens at the gateway before requests reach the MCP server. Claude receives a session identifier — not your raw Entra tokens. Anthropic never sees your authentication credentials."

### Technical Proof Points

**Token Lifetimes:**
| Token Type | Default Lifetime | Configurable |
|------------|------------------|--------------|
| Access Token | 60-90 minutes | Yes, via token lifetime policies |
| Refresh Token | 90 days (sliding) | Yes |
| ID Token | 60-90 minutes | Yes |

**Where Tokens Live:**
- **User's browser**: During OAuth flow only
- **Claude/MCP Client**: Stores access token for session duration
- **APIM**: Validates but does not store tokens
- **MCP Server**: Receives token, exchanges via OBO, does not persist
- **Anthropic servers**: Never receive raw Entra tokens

**Does Claude/Anthropic See the Raw Token?**
- Claude receives the access token to present to the MCP server
- This is necessary for the OAuth flow to work
- However, the token is:
  - Audience-restricted (only valid for the specific MCP server)
  - Short-lived (60-90 minutes)
  - Useless without the MCP server's client credentials for OBO

**APIM Token Protection:**
```xml
<!-- APIM validates token before forwarding -->
<validate-azure-ad-token tenant-id="{tenant}"
    header-name="Authorization"
    failed-validation-httpcode="401">
    <client-application-ids>
        <application-id>{claude-client-id}</application-id>
    </client-application-ids>
</validate-azure-ad-token>
```

**Security Boundaries:**
1. **APIM Gateway**: Validates token signature, expiry, audience, issuer
2. **Token never logged**: Authorization headers excluded from APIM logs by default
3. **Backend isolation**: MCP server FQDN not exposed publicly — only APIM endpoint
4. **OBO exchange**: Downstream tokens never sent back to client

**Session Identifier Pattern:**
- MCP protocol uses session IDs for request correlation
- These are opaque identifiers, not authentication tokens
- Authentication is handled via Bearer tokens in HTTP headers

### Microsoft Documentation
- [validate-azure-ad-token policy](https://learn.microsoft.com/en-us/azure/api-management/validate-azure-ad-token-policy)
- [Secure access to MCP servers in Azure API Management](https://learn.microsoft.com/en-us/azure/api-management/secure-mcp-servers)
- [Configurable token lifetimes](https://learn.microsoft.com/en-us/entra/identity-platform/configurable-token-lifetimes)

---

## 6. Audit and Logging

### Plain English (for slide)
> "Every authentication event is logged in Entra ID sign-in logs. Every API call is logged in APIM with full request metadata. Your existing SIEM integration captures MCP activity alongside all other Azure telemetry — ready for SOC 2 and ISO 27001 audits."

### Technical Proof Points

**Entra ID Sign-In Logs Capture:**
| Field | Description |
|-------|-------------|
| User identity | UPN, object ID, display name |
| Application | App ID, app name (MCP server) |
| IP address | Client IP, location |
| Device info | Device ID, compliance state, OS |
| Authentication method | MFA method used |
| Conditional Access | Policies applied, grant/block result |
| Risk level | Sign-in risk, user risk |
| Timestamp | Precise datetime |
| Correlation ID | For tracing across services |

**APIM Diagnostic Logs Capture:**
| Field | Description |
|-------|-------------|
| Request ID | Unique request identifier |
| Operation | API operation name (MCP tool name) |
| Client IP | Caller's IP address |
| Response code | HTTP status |
| Response time | Latency metrics |
| Backend URL | MCP server endpoint called |
| Subscription | APIM subscription key used |
| User ID | From validated JWT claims |
| Request/Response body | Optional, configurable |

**APIM Logging Configuration:**
```xml
<!-- Diagnostic settings in APIM -->
<diagnostic name="azuremonitor">
    <log-type>apimanagement-gateway</log-type>
    <destination>
        <log-analytics workspace-id="{workspace}"/>
    </destination>
</diagnostic>
```

**Compliance Framework Mapping:**

| Requirement | Entra ID | APIM | Evidence |
|-------------|----------|------|----------|
| **SOC 2 CC6.1** (Logical access) | ✅ Sign-in logs | ✅ Request logs | User identity verified |
| **SOC 2 CC7.2** (System monitoring) | ✅ Audit logs | ✅ Metrics | Anomaly detection |
| **ISO 27001 A.12.4** (Logging) | ✅ 30-day retention (P1/P2) | ✅ Configurable | Event logging |
| **ISO 27001 A.9.4** (Access control) | ✅ CA policies | ✅ Policy enforcement | Access decisions logged |

**Log Retention:**
- Entra ID Free: 7 days
- Entra ID P1/P2: 30 days (extendable via Log Analytics)
- APIM: Configurable, stream to Log Analytics, Storage, Event Hub

### Microsoft Documentation
- [Sign-in logs in Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-sign-ins)
- [Audit logs in Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-audit-logs)
- [Monitor APIs in Azure API Management](https://learn.microsoft.com/en-us/azure/api-management/api-management-howto-use-azure-monitor)

---

## 7. Data Residency

### Plain English (for slide)
> "With self-hosted MCP servers, your data never leaves your Azure tenant. The MCP server runs in your subscription, calls APIs in your tenant, and returns answers to Claude. Microsoft's cloud-hosted endpoints follow their standard data handling policies for your region."

### Technical Proof Points

**Self-Hosted MCP Server Data Flow:**
```
User Query → Claude (Anthropic) → APIM (Your Tenant) → MCP Server (Your Tenant)
    → Microsoft APIs (Your Tenant) → Response → Claude → User
```

**What Stays in Your Tenant:**
- ✅ MCP Server compute (Container Apps, Functions, App Service)
- ✅ API calls to D365, Graph, Azure resources
- ✅ Data retrieved from Microsoft APIs
- ✅ APIM gateway and logs
- ✅ Key Vault secrets
- ✅ All Azure infrastructure

**What Goes to Anthropic:**
- ⚠️ User's natural language query
- ⚠️ MCP tool responses (the data retrieved)
- ⚠️ Claude's response to the user

**Microsoft Cloud-Hosted MCP Endpoints:**
- Operate under Microsoft's standard data handling policies
- Subject to Microsoft's data residency commitments for your tenant's region
- User authenticates directly with Microsoft; Anthropic receives only the user's token for that specific resource

**Microsoft's Data Isolation Principles:**
- Data isolation techniques separate cloud tenants
- Customers can only access their own data
- Data encrypted at rest and in transit
- Only the data owner holds encryption keys

**For Regulated Industries:**
- Self-hosted deployment keeps all data within tenant boundary
- Can deploy in sovereign clouds (Azure Government, Azure China)
- Network isolation via VNet integration
- Private endpoints for Azure services

### Microsoft Documentation
- [Explore Foundry MCP Server best practices and security guidance](https://learn.microsoft.com/en-us/azure/ai-foundry/mcp/security-best-practices)
- [Privacy and data management overview](https://learn.microsoft.com/en-us/compliance/assurance/assurance-privacy)
- [Data Residency, Data Sovereignty, and Compliance in the Microsoft Cloud (PDF)](https://azure.microsoft.com/mediahandler/files/resourcefiles/data-residency-data-sovereignty-and-compliance-in-the-microsoft-cloud/Data_Residency_Data_Sovereignty_Compliance_Microsoft_Cloud.pdf)

---

## Summary Security Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER'S AZURE TENANT                                  │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   Entra ID   │    │     APIM     │    │  MCP Server  │                   │
│  │              │    │              │    │ (Container   │                   │
│  │ • OAuth 2.1  │───▶│ • Token      │───▶│   Apps)      │                   │
│  │ • MFA        │    │   Validation │    │              │                   │
│  │ • Cond.Access│    │ • Logging    │    │ • OBO Flow   │                   │
│  │ • Audit Logs │    │ • Rate Limit │    │ • Tool Exec  │                   │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                   │
│         │                                        │                           │
│         │ Sign-in Logs                          │ OBO Token                  │
│         ▼                                        ▼                           │
│  ┌──────────────┐                        ┌──────────────┐                   │
│  │Log Analytics │                        │ Microsoft    │                   │
│  │   / SIEM     │                        │ APIs         │                   │
│  │              │                        │ • Graph      │                   │
│  │ SOC 2 / ISO  │                        │ • D365       │                   │
│  │ 27001 Ready  │                        │ • Azure      │                   │
│  └──────────────┘                        │ • Fabric     │                   │
│                                          └──────────────┘                   │
│                                                 │                            │
│                                                 │ User's RBAC                │
│                                                 │ Applied                    │
│                                                 ▼                            │
│                                          ┌──────────────┐                   │
│                                          │ Your Data    │                   │
│                                          │ (Scoped to   │                   │
│                                          │  User's      │                   │
│                                          │  Permissions)│                   │
│                                          └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
         ▲                                                           │
         │ OAuth Flow                                                │
         │ (Browser Redirect)                                        │ Response
         │                                                           ▼
┌────────┴────────────────────────────────────────────────────────────────────┐
│                           ANTHROPIC                                          │
│                                                                              │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐         │
│  │    Claude    │────────▶│  MCP Client  │────────▶│    User      │         │
│  │              │         │              │         │              │         │
│  │ • NL Query   │         │ • Bearer     │         │ • Answer     │         │
│  │ • Tool Call  │         │   Token      │         │              │         │
│  │ • Response   │         │ • Session ID │         │              │         │
│  └──────────────┘         └──────────────┘         └──────────────┘         │
│                                                                              │
│  Token is: Short-lived, Audience-restricted, Cannot call other APIs         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Talking Points for CTO

1. **"No standing access"** — With OBO flow implementation, MCP server exchanges user tokens for downstream access; no stored credentials or persistent API access. *(Note: Requires custom MCP server code — not built into Microsoft's official MCPs.)*

2. **"Your controls, your policies"** — Existing Conditional Access, RBAC, and audit infrastructure applies automatically.

3. **"Data stays in your tenant"** — Self-hosted option keeps all data flow within your Azure subscription.

4. **"Industry-standard protocols"** — OAuth 2.1, RFC 9728, PKCE — not proprietary authentication.

5. **"Audit-ready"** — Every authentication and API call logged; maps directly to SOC 2/ISO 27001 controls.

6. **"Defense in depth"** — APIM validates before MCP server sees the request; RBAC enforced at every downstream API.

7. **"Identity options"** — Choose between shared Managed Identity (simpler) or user-scoped OBO (more secure) based on data sensitivity requirements.
