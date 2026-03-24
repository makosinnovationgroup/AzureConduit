# Option 5 — Custom MCP Server

**For clients with non-Microsoft systems, on-premises data, or cross-system business logic.**

---

## What a Custom MCP Server Actually Is

An MCP server is just a process — a Node.js, Python, or .NET application — that listens for HTTP requests from Claude and responds with data or actions. You define **tools**: named functions with descriptions that Claude can call. Claude reads the tool list, decides which ones to call based on the user's question, and assembles the response.

A simple tool definition looks like this:

```typescript
server.tool(
  "get_overdue_accounts",
  "Returns all customer accounts with outstanding balances over 90 days",
  { limit: z.number().optional() },
  async ({ limit }) => {
    const results = await sqlClient.query(
      `SELECT account_id, name, balance, due_date 
       FROM accounts WHERE due_date < DATEADD(day, -90, GETDATE())
       ORDER BY balance DESC`,
      { limit: limit ?? 50 }
    );
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);
```

Claude doesn't see SQL. It sees a tool called `get_overdue_accounts` with a plain English description. When a user asks *"who owes us the most money right now?"*, Claude calls the tool and turns the result into a plain English answer.

---

## Infrastructure: No Change from Options 2–4

The Terraform module is identical. You deploy the same Container Apps + APIM + Entra stack. The only difference is **what Docker image runs inside the container** — your custom MCP server instead of Microsoft's.

```
Same Terraform module
       │
       ▼
Azure Container App
  └─ YOUR custom MCP server image   ← this is the only thing that changes
       │
       ├─ Connects to SQL Server (Azure or on-prem via VNet)
       ├─ Connects to Salesforce API
       ├─ Connects to Microsoft Graph (via OBO flow)
       ├─ Connects to SAP RFC/REST
       └─ Any other system with an API or database driver
```

This means you can scope, price, and deliver the infrastructure work independently of the custom server code. The Terraform deployment is the same billable effort regardless.

---

## Use Cases That Require a Custom MCP Server

### Non-Microsoft Systems
Any system Microsoft's MCP servers don't speak to:
- **Salesforce** — CRM data, opportunities, contacts, cases
- **SAP** — ERP data, purchase orders, HR records
- **Oracle** — databases, Fusion ERP
- **Custom/legacy SQL databases** — any SQL Server, PostgreSQL, MySQL not in Azure
- **Third-party SaaS** — any platform with an API (Zendesk, HubSpot, QuickBooks, etc.)

### On-Premises Systems
- SQL Server running in the client's data center
- Legacy LOB applications with local APIs or database access
- Manufacturing systems (SCADA, MES)
- Requires VNet Integration on the Container App — see the SQL connectivity note below

### Cross-System Business Logic
Even when all systems are Microsoft, a custom MCP tool is valuable when:
- A "simple" question requires joining data across multiple APIs
- The answer requires applying business rules Claude can't infer
- You want to pre-build curated, safe queries rather than letting Claude generate raw API calls

Example: *"What's the health of our top 10 accounts?"* might require:
1. Pull top accounts from D365 Sales
2. Get open support tickets from a helpdesk system
3. Get outstanding invoices from D365 Finance
4. Combine into a single account health summary

A custom tool called `get_account_health` wraps all of that. Claude calls one tool, gets one clean result.

### Compliance and Data Residency
Some clients cannot allow data to flow through Microsoft's hosted MCP endpoints — it must stay entirely within their Azure tenant. A custom self-hosted server satisfies this even for Microsoft data sources.

---

## Authentication: OBO Flow for User-Scoped Access

The custom MCP server authenticates to downstream systems using the same **On-Behalf-Of (OBO)** pattern as the Microsoft servers:

1. User authenticates to Claude via Entra ID
2. Their token arrives at APIM, which validates it
3. The Container App receives the validated token
4. The MCP server exchanges it (OBO) for a token that calls downstream APIs *as that user*
5. The downstream system sees the user's identity and applies their permissions

For non-Entra systems (Salesforce, on-prem SQL), the Managed Identity holds a service account credential in Key Vault. The MCP server fetches it at runtime — no secrets in code or environment variables.

---

## On-Premises SQL: VNet Integration

For clients with SQL Server on-premises or in a private network, the Container App needs network access. Add these to the Terraform module:

```hcl
# VNet integration for the Container App environment
resource "azurerm_container_app_environment" "main" {
  # ... existing config ...
  infrastructure_subnet_id = azurerm_subnet.aca.id  # add this
}

# Subnet delegated to Container Apps
resource "azurerm_subnet" "aca" {
  name                 = "acd-${var.client_name}-aca-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.1.0/24"]
  delegation { ... }
}

# Peer to client's on-prem VNet or use their existing VPN/ExpressRoute
resource "azurerm_virtual_network_peering" "to_onprem" { ... }
```

The custom MCP server then uses a standard SQL driver (e.g. `mssql` for Node.js, `pyodbc` for Python) — it connects to the on-prem SQL instance over the private network path as if it were local.

---

## Building the Custom Server

Use the `CLAUDE_CODE_PROMPT_CUSTOM.md` prompt in Claude Code to scaffold the server. It generates:

- Tool definitions for the client's specific systems
- OBO auth flow for Microsoft APIs
- Key Vault secret retrieval for non-Microsoft credentials
- SQL connection pooling
- A Dockerfile ready to push to ACR and deploy into the AzureConduit Container App

---

## Effort and Pricing Guidance

| Complexity | Example | Estimated Build Time |
|---|---|---|
| Single system, read-only | On-prem SQL reporting | 1–2 days |
| Two systems, read-only | D365 + Salesforce | 2–3 days |
| Multi-system with business logic | Account health across 4 systems | 3–5 days |
| Write operations + approval flows | Create PO, update records | 5–8 days |

Infrastructure (Terraform) is a fixed cost on top — roughly 4–8 hours regardless of server complexity.

---

## When to Use This Option

✅ Client has non-Microsoft systems (Salesforce, SAP, Oracle, custom databases)
✅ Client has on-premises SQL Server or legacy systems
✅ Need to join data across multiple systems for business logic
✅ Client requires data to stay entirely within their Azure tenant (even for Microsoft sources)
✅ Client wants curated, safe queries instead of raw API access
❌ Client only uses Microsoft cloud systems → use [Option 2 (Container Apps)](./02-self-hosted-aca.md) with Microsoft's MCP image
❌ Client only needs M365 → use [Option 1 (Cloud-Hosted)](./01-cloud-hosted.md)

---

## Example Client Scenarios

**Use this option when the client says:**

> *"We use Salesforce for CRM and Dynamics 365 for finance."*

A hybrid environment where sales data lives in Salesforce and financial data in D365. The custom MCP server connects to both, letting users ask "What's the invoice status for our top Salesforce opportunities?" **2–3 days to build the server.**

---

> *"Our main database is an on-prem SQL Server in our data center."*

A manufacturing company with legacy systems. Their ERP runs on SQL Server in their own facility. The custom MCP server connects via VNet peering, letting users query production data without migrating to the cloud. **Requires VNet integration in Terraform.**

---

> *"We want Claude to answer 'What's the health of our top 10 accounts?' — but that requires data from 4 different systems."*

A complex question requiring:
1. Account list from D365 Sales
2. Support tickets from Zendesk
3. Invoices from D365 Finance
4. Usage metrics from a custom analytics DB

A custom `get_account_health` tool wraps all four calls. Claude asks one question, gets one clean answer. **3–5 days to build.**

---

> *"We use SAP for ERP and need Claude to check purchase order status."*

SAP isn't covered by Microsoft's MCP servers. A custom MCP server with SAP RFC or REST connector lets users ask "What POs are pending approval?" **1–2 days for basic SAP read access.**

---

> *"Even though we only use Microsoft systems, compliance says data can't flow through any external endpoints."*

A regulated industry (finance, healthcare, government) with strict data residency. Even for D365 and M365, they need a self-hosted server. Same Microsoft API calls, but running entirely within their tenant.

---

> *"We have a homegrown CRM our dev team built 10 years ago."*

Legacy internal systems with REST APIs or direct database access. A custom MCP server exposes these as tools, giving Claude access to data that no off-the-shelf integration covers.

---

**Don't use this option when:**

> *"We only use D365 and M365 — nothing else."*

Microsoft's MCP server image handles this. → Use [Option 2 (Container Apps)](./02-self-hosted-aca.md).

> *"We just want email and calendar access."*

No custom code needed. → Use [Option 1 (Cloud-Hosted)](./01-cloud-hosted.md).
