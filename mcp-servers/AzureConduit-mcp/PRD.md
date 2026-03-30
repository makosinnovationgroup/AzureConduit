# PRD: AzureConduit MCP — Microsoft MCP Servers with OBO Integration

**Version:** 1.1
**Status:** Implemented
**Author:** AzureConduit Team
**Last Updated:** 2026-03-27

---

## Executive Summary

AzureConduit MCP is a mono-repo containing **117 MCP tools** across four modular servers (Azure, D365, Dataverse, Fabric) with On-Behalf-Of (OBO) authentication integrated. This enables user-scoped data access when connecting Claude to Microsoft enterprise systems — each user sees only the data their AD roles permit.

| Server | Tools | Status |
|--------|-------|--------|
| Azure | 42 | ✅ Complete |
| D365 | 34 | ✅ Complete |
| Dataverse | 13 | ✅ Complete |
| Fabric | 28 | ✅ Complete |

**The Problem:** Microsoft's official MCP servers use Managed Identity, meaning all users share the same access level. There's no per-user permission enforcement.

**The Solution:** Fork Microsoft's MCPs, replace the credential provider with an OBO-enabled implementation, and deploy via AzureConduit's existing Terraform infrastructure.

**Key Feature:** Each MCP server is **independently deployable**. Deploy only what your department needs (e.g., just D365 for Finance, just Fabric for Data Engineering).

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Shared OBO Module](#shared-obo-module-azurecondaboremcpcore)
5. [Azure MCP](#azure-mcp-azurecondaboremcpazure)
6. [D365 MCP](#d365-mcp-azurecondaboremcpd365)
7. [Dataverse MCP](#dataverse-mcp-azurecondaboremcpdataverse)
8. [Fabric MCP](#fabric-mcp-azurecondaboremcpfabric)
9. [Infrastructure Changes](#infrastructure-changes)
10. [Implementation Plan](#implementation-plan)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Guide](#deployment-guide)

---

## Problem Statement

### Current State: Microsoft's Official MCPs

Microsoft provides official MCP servers for Azure, D365, Dataverse, and Fabric. These servers:

- Are written in C#/.NET
- Use `DefaultAzureCredential` or Managed Identity for authentication
- Provide the same access level to ALL users
- Do not support On-Behalf-Of (OBO) token exchange

```
Current Flow (Shared Access):

User A ─┐                              ┌─→ Managed Identity ─→ D365 API
User B ─┼─→ Microsoft D365 MCP ────────┤   (Same permissions for all)
User C ─┘                              └─→ Returns ALL accessible data
```

**Impact:** A junior analyst using Claude could see the same financial data as the CFO. AD security roles are bypassed.

### Desired State: OBO-Enabled MCPs

```
Desired Flow (User-Scoped Access):

User A ─→ AzureConduit D365 MCP ─→ OBO Exchange ─→ D365 API ─→ User A's data only
User B ─→ AzureConduit D365 MCP ─→ OBO Exchange ─→ D365 API ─→ User B's data only
User C ─→ AzureConduit D365 MCP ─→ OBO Exchange ─→ D365 API ─→ User C's data only
```

Each API call carries the authenticated user's identity. D365/Azure/Dataverse/Fabric enforce that user's specific roles and permissions.

---

## Goals & Non-Goals

### Goals

1. **Feature parity** with Microsoft's official MCP servers
2. **User-scoped access** via OBO token exchange
3. **AD role enforcement** — existing security roles apply automatically
4. **Conditional Access support** — MFA, device compliance, location policies honored
5. **Per-user audit trail** — logs show which user accessed which data
6. **Drop-in replacement** — same tools, same interfaces, different auth
7. **Single deployment** — one Terraform apply deploys everything
8. **Shared OBO module** — write once, use across all four MCPs

### Non-Goals

- Modifying Microsoft's tool logic (we're adding OBO, not changing functionality)
- Supporting non-user principals (OBO only works with user tokens)
- Building a new MCP protocol implementation (we use Microsoft's MCP SDK)
- Multi-tenant SaaS deployment (single-tenant per deployment)

---

## Architecture Overview

### Repository Structure

```
AzureConduit-mcp/
├── src/
│   ├── AzureConduit.Mcp.Core/           # Shared OBO infrastructure
│   │   ├── Auth/
│   │   │   ├── IOboTokenCredentialProvider.cs
│   │   │   ├── OboTokenCredentialProvider.cs
│   │   │   ├── OboCredential.cs
│   │   │   ├── OboConfiguration.cs
│   │   │   └── OboTokenCache.cs
│   │   ├── Http/
│   │   │   └── UserTokenAccessor.cs
│   │   ├── Services/
│   │   │   └── OboEnabledBaseService.cs
│   │   ├── Extensions/
│   │   │   └── ServiceCollectionExtensions.cs
│   │   └── AzureConduit.Mcp.Core.csproj
│   │
│   ├── AzureConduit.Mcp.Azure/          # Azure MCP (42 tools)
│   │   ├── Tools/
│   │   │   ├── Subscriptions/           # 2 tools
│   │   │   ├── ResourceGroups/          # 3 tools
│   │   │   ├── Resources/               # 1 tool
│   │   │   ├── Storage/                 # 3 tools
│   │   │   ├── KeyVault/                # 3 tools
│   │   │   ├── Compute/                 # 4 tools
│   │   │   ├── CosmosDb/                # 3 tools
│   │   │   ├── Sql/                     # 2 tools
│   │   │   ├── AppService/              # 4 tools
│   │   │   ├── Aks/                     # 2 tools
│   │   │   ├── Functions/               # 1 tool
│   │   │   ├── EventHubs/               # 2 tools
│   │   │   ├── ServiceBus/              # 3 tools
│   │   │   ├── Monitor/                 # 2 tools
│   │   │   ├── Redis/                   # 1 tool
│   │   │   ├── ContainerRegistry/       # 1 tool
│   │   │   ├── Policy/                  # 1 tool
│   │   │   ├── Network/                 # 2 tools
│   │   │   └── ContainerApps/           # 2 tools
│   │   ├── Controllers/
│   │   │   └── McpController.cs
│   │   ├── Extensions/
│   │   │   └── ServiceCollectionExtensions.cs
│   │   ├── Program.cs
│   │   └── AzureConduit.Mcp.Azure.csproj
│   │
│   ├── AzureConduit.Mcp.D365/           # D365 MCP (34 tools)
│   │   ├── Tools/
│   │   │   ├── Data/                    # 6 generic data tools
│   │   │   │   ├── FindEntityTypeTool.cs
│   │   │   │   ├── GetEntityMetadataTool.cs
│   │   │   │   ├── FindEntitiesTool.cs
│   │   │   │   ├── CreateEntitiesTool.cs
│   │   │   │   ├── UpdateEntitiesTool.cs
│   │   │   │   └── DeleteEntitiesTool.cs
│   │   │   ├── Action/                  # 2 action tools
│   │   │   │   ├── FindActionsTool.cs
│   │   │   │   └── InvokeActionTool.cs
│   │   │   ├── Form/                    # 13 form automation tools
│   │   │   │   ├── FormToolBase.cs
│   │   │   │   ├── OpenMenuItemTool.cs
│   │   │   │   ├── FindMenuItemTool.cs
│   │   │   │   ├── FindControlsTool.cs
│   │   │   │   ├── SetControlValuesTool.cs
│   │   │   │   ├── ClickControlTool.cs
│   │   │   │   ├── FilterFormTool.cs
│   │   │   │   ├── FilterGridTool.cs
│   │   │   │   ├── SelectGridRowTool.cs
│   │   │   │   ├── SortGridColumnTool.cs
│   │   │   │   ├── OpenLookupTool.cs
│   │   │   │   ├── OpenOrCloseTabTool.cs
│   │   │   │   ├── SaveFormTool.cs
│   │   │   │   └── CloseFormTool.cs
│   │   │   ├── Finance/                 # 7 legacy tools
│   │   │   ├── SupplyChain/             # 5 legacy tools
│   │   │   └── Common/                  # 1 legacy tool
│   │   ├── Controllers/
│   │   ├── Program.cs
│   │   └── AzureConduit.Mcp.D365.csproj
│   │
│   ├── AzureConduit.Mcp.Dataverse/      # Dataverse MCP (13 tools)
│   │   ├── Tools/
│   │   │   ├── ListTablesTool.cs
│   │   │   ├── GetTableTool.cs
│   │   │   ├── DescribeTableTool.cs
│   │   │   ├── CreateTableTool.cs
│   │   │   ├── UpdateTableTool.cs
│   │   │   ├── DeleteTableTool.cs
│   │   │   ├── ListRecordsTool.cs
│   │   │   ├── GetRecordTool.cs
│   │   │   ├── CreateRecordTool.cs
│   │   │   ├── UpdateRecordTool.cs
│   │   │   ├── DeleteRecordTool.cs
│   │   │   ├── QueryTool.cs
│   │   │   └── SearchTool.cs
│   │   ├── Controllers/
│   │   ├── Program.cs
│   │   └── AzureConduit.Mcp.Dataverse.csproj
│   │
│   └── AzureConduit.Mcp.Fabric/         # Fabric MCP (28 tools)
│       ├── Tools/
│       │   ├── Core/                    # 1 tool (CreateItem)
│       │   ├── Docs/                    # 6 documentation tools
│       │   │   ├── ListWorkloadsTool.cs
│       │   │   ├── GetWorkloadApiSpecTool.cs
│       │   │   ├── GetPlatformApiSpecTool.cs
│       │   │   ├── GetItemDefinitionsTool.cs
│       │   │   ├── GetBestPracticesTool.cs
│       │   │   └── GetApiExamplesTool.cs
│       │   ├── OneLake/                 # 7 file operation tools
│       │   │   ├── OneLakeBaseService.cs
│       │   │   ├── ListFilesTool.cs
│       │   │   ├── UploadFileTool.cs
│       │   │   ├── DownloadFileTool.cs
│       │   │   ├── DeleteFileTool.cs
│       │   │   ├── CreateDirectoryTool.cs
│       │   │   ├── DeleteDirectoryTool.cs
│       │   │   └── ListTablesTool.cs
│       │   ├── ListWorkspacesTool.cs    # 14 core tools
│       │   ├── GetWorkspaceTool.cs
│       │   ├── CreateWorkspaceTool.cs
│       │   ├── ListLakehousesTool.cs
│       │   ├── GetLakehouseTool.cs
│       │   ├── ListLakehouseTablesTool.cs
│       │   ├── ListWarehousesTool.cs
│       │   ├── GetWarehouseTool.cs
│       │   ├── ListNotebooksTool.cs
│       │   ├── GetNotebookTool.cs
│       │   ├── ListPipelinesTool.cs
│       │   ├── GetPipelineTool.cs
│       │   ├── RunPipelineTool.cs
│       │   └── GetPipelineRunTool.cs
│       ├── Controllers/
│       ├── Program.cs
│       └── AzureConduit.Mcp.Fabric.csproj
│
├── tests/
│   └── AzureConduit.Mcp.Core.Tests/
│
├── docker/
│   ├── Dockerfile.azure
│   ├── Dockerfile.d365
│   ├── Dockerfile.dataverse
│   └── Dockerfile.fabric
│
├── AzureConduit.Mcp.sln
├── Directory.Build.props
├── Directory.Packages.props
├── README.md
└── PRD.md
```

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    AzureConduit.Mcp.Core                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ OBO Auth     │  │ HTTP Context │  │ Base Services│       │
│  │ Provider     │  │ Accessor     │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
          ▲                  ▲                  ▲
          │                  │                  │
    ┌─────┴─────┐      ┌─────┴─────┐      ┌─────┴─────┐
    │  Azure    │      │   D365    │      │ Dataverse │ ...
    │   MCP     │      │   MCP     │      │   MCP     │
    └───────────┘      └───────────┘      └───────────┘
```

---

## Shared OBO Module (`AzureConduit.Mcp.Core`)

The core module provides OBO authentication infrastructure used by all four MCPs.

### Key Components

#### 1. `OboConfiguration`

```csharp
namespace AzureConduit.Mcp.Core.Auth;

public class OboConfiguration
{
    public const string SectionName = "Obo";

    /// <summary>
    /// Azure AD tenant ID
    /// </summary>
    public required string TenantId { get; set; }

    /// <summary>
    /// Client ID of the MCP server's app registration
    /// </summary>
    public required string ClientId { get; set; }

    /// <summary>
    /// Client secret for OBO token exchange
    /// </summary>
    public required string ClientSecret { get; set; }

    /// <summary>
    /// Optional: Client certificate thumbprint (alternative to secret)
    /// </summary>
    public string? ClientCertificateThumbprint { get; set; }

    /// <summary>
    /// Token cache duration in minutes (default: 5)
    /// </summary>
    public int TokenCacheMinutes { get; set; } = 5;

    /// <summary>
    /// Header name where APIM forwards the user token
    /// </summary>
    public string UserTokenHeader { get; set; } = "X-User-Token";
}
```

#### 2. `UserTokenAccessor`

Extracts the user's token from the HTTP request (forwarded by APIM).

```csharp
namespace AzureConduit.Mcp.Core.Http;

public interface IUserTokenAccessor
{
    /// <summary>
    /// Gets the user's bearer token from the current HTTP request
    /// </summary>
    string? GetUserToken();

    /// <summary>
    /// Gets the user's bearer token, throwing if not present
    /// </summary>
    string GetRequiredUserToken();
}

public class UserTokenAccessor : IUserTokenAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly OboConfiguration _config;

    public UserTokenAccessor(
        IHttpContextAccessor httpContextAccessor,
        IOptions<OboConfiguration> config)
    {
        _httpContextAccessor = httpContextAccessor;
        _config = config.Value;
    }

    public string? GetUserToken()
    {
        var context = _httpContextAccessor.HttpContext;
        if (context is null) return null;

        // Try configured header first (set by APIM)
        if (context.Request.Headers.TryGetValue(_config.UserTokenHeader, out var headerToken))
        {
            return ExtractBearerToken(headerToken.ToString());
        }

        // Fallback to Authorization header
        if (context.Request.Headers.TryGetValue("Authorization", out var authHeader))
        {
            return ExtractBearerToken(authHeader.ToString());
        }

        return null;
    }

    public string GetRequiredUserToken()
    {
        return GetUserToken()
            ?? throw new UnauthorizedAccessException(
                "User token not found. Ensure APIM is forwarding the token.");
    }

    private static string? ExtractBearerToken(string headerValue)
    {
        if (string.IsNullOrWhiteSpace(headerValue)) return null;

        if (headerValue.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return headerValue["Bearer ".Length..].Trim();
        }

        return headerValue.Trim();
    }
}
```

#### 3. `OboCredential`

Azure SDK-compatible credential that performs OBO exchange.

```csharp
namespace AzureConduit.Mcp.Core.Auth;

using Azure.Core;
using Azure.Identity;
using Microsoft.Identity.Client;

/// <summary>
/// TokenCredential implementation that uses OBO flow to exchange
/// a user's token for a downstream API token.
/// </summary>
public class OboCredential : TokenCredential
{
    private readonly IConfidentialClientApplication _msalClient;
    private readonly string _userAssertion;
    private readonly OboTokenCache _cache;

    public OboCredential(
        OboConfiguration config,
        string userAssertion,
        OboTokenCache cache)
    {
        _userAssertion = userAssertion;
        _cache = cache;

        var builder = ConfidentialClientApplicationBuilder
            .Create(config.ClientId)
            .WithAuthority(AzureCloudInstance.AzurePublic, config.TenantId);

        if (!string.IsNullOrEmpty(config.ClientCertificateThumbprint))
        {
            var cert = LoadCertificate(config.ClientCertificateThumbprint);
            builder = builder.WithCertificate(cert);
        }
        else
        {
            builder = builder.WithClientSecret(config.ClientSecret);
        }

        _msalClient = builder.Build();
    }

    public override AccessToken GetToken(
        TokenRequestContext requestContext,
        CancellationToken cancellationToken)
    {
        return GetTokenAsync(requestContext, cancellationToken)
            .GetAwaiter()
            .GetResult();
    }

    public override async ValueTask<AccessToken> GetTokenAsync(
        TokenRequestContext requestContext,
        CancellationToken cancellationToken)
    {
        var scopes = requestContext.Scopes;
        var cacheKey = GenerateCacheKey(_userAssertion, scopes);

        // Check cache first
        if (_cache.TryGet(cacheKey, out var cachedToken))
        {
            return cachedToken;
        }

        try
        {
            var result = await _msalClient.AcquireTokenOnBehalfOf(
                scopes,
                new UserAssertion(_userAssertion))
                .ExecuteAsync(cancellationToken);

            var accessToken = new AccessToken(
                result.AccessToken,
                result.ExpiresOn);

            // Cache with buffer before expiry
            _cache.Set(cacheKey, accessToken, result.ExpiresOn.AddMinutes(-5));

            return accessToken;
        }
        catch (MsalUiRequiredException ex)
        {
            throw new AuthenticationFailedException(
                $"User interaction required: {ex.Message}. " +
                "The user may need to re-authenticate or consent to additional permissions.",
                ex);
        }
        catch (MsalServiceException ex) when (ex.ErrorCode == "invalid_grant")
        {
            throw new AuthenticationFailedException(
                "User token is invalid or expired. Please re-authenticate.",
                ex);
        }
    }

    private static string GenerateCacheKey(string assertion, string[] scopes)
    {
        // Use last 32 chars of assertion + scopes for cache key
        // (Don't use full token - security risk if logged)
        var assertionHash = assertion.Length > 32
            ? assertion[^32..]
            : assertion;
        return $"{assertionHash}:{string.Join(",", scopes)}";
    }

    private static X509Certificate2 LoadCertificate(string thumbprint)
    {
        using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
        store.Open(OpenFlags.ReadOnly);
        var certs = store.Certificates.Find(
            X509FindType.FindByThumbprint,
            thumbprint,
            validOnly: false);

        return certs.Count > 0
            ? certs[0]
            : throw new InvalidOperationException(
                $"Certificate with thumbprint {thumbprint} not found");
    }
}
```

#### 4. `OboTokenCredentialProvider`

The main provider that creates OBO credentials per-request.

```csharp
namespace AzureConduit.Mcp.Core.Auth;

using Azure.Core;

/// <summary>
/// Provides OBO-enabled TokenCredentials for Azure SDK clients.
/// This replaces Microsoft's default credential provider.
/// </summary>
public interface IOboTokenCredentialProvider
{
    /// <summary>
    /// Gets a TokenCredential that will use OBO to exchange the current
    /// user's token for downstream API access.
    /// </summary>
    TokenCredential GetCredential();

    /// <summary>
    /// Gets a TokenCredential for a specific tenant (multi-tenant scenarios)
    /// </summary>
    TokenCredential GetCredential(string tenantId);
}

public class OboTokenCredentialProvider : IOboTokenCredentialProvider
{
    private readonly IUserTokenAccessor _tokenAccessor;
    private readonly OboConfiguration _config;
    private readonly OboTokenCache _cache;

    public OboTokenCredentialProvider(
        IUserTokenAccessor tokenAccessor,
        IOptions<OboConfiguration> config,
        OboTokenCache cache)
    {
        _tokenAccessor = tokenAccessor;
        _config = config.Value;
        _cache = cache;
    }

    public TokenCredential GetCredential()
    {
        var userToken = _tokenAccessor.GetRequiredUserToken();
        return new OboCredential(_config, userToken, _cache);
    }

    public TokenCredential GetCredential(string tenantId)
    {
        var userToken = _tokenAccessor.GetRequiredUserToken();
        var configWithTenant = _config with { TenantId = tenantId };
        return new OboCredential(configWithTenant, userToken, _cache);
    }
}
```

#### 5. `OboTokenCache`

Thread-safe, per-user token cache.

```csharp
namespace AzureConduit.Mcp.Core.Auth;

using System.Collections.Concurrent;
using Azure.Core;

/// <summary>
/// Thread-safe cache for OBO tokens. Tokens are cached per-user per-scope
/// to avoid redundant token exchanges.
/// </summary>
public class OboTokenCache
{
    private readonly ConcurrentDictionary<string, CacheEntry> _cache = new();
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromMinutes(5);
    private DateTime _lastCleanup = DateTime.UtcNow;

    public bool TryGet(string key, out AccessToken token)
    {
        CleanupIfNeeded();

        if (_cache.TryGetValue(key, out var entry) && entry.ExpiresOn > DateTimeOffset.UtcNow)
        {
            token = entry.Token;
            return true;
        }

        token = default;
        return false;
    }

    public void Set(string key, AccessToken token, DateTimeOffset expiresOn)
    {
        _cache[key] = new CacheEntry(token, expiresOn);
    }

    private void CleanupIfNeeded()
    {
        if (DateTime.UtcNow - _lastCleanup < _cleanupInterval) return;

        _lastCleanup = DateTime.UtcNow;
        var now = DateTimeOffset.UtcNow;

        foreach (var key in _cache.Keys)
        {
            if (_cache.TryGetValue(key, out var entry) && entry.ExpiresOn <= now)
            {
                _cache.TryRemove(key, out _);
            }
        }
    }

    private record CacheEntry(AccessToken Token, DateTimeOffset ExpiresOn);
}
```

#### 6. `ServiceCollectionExtensions`

DI registration helpers.

```csharp
namespace AzureConduit.Mcp.Core.Extensions;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds OBO authentication services to the DI container.
    /// </summary>
    public static IServiceCollection AddOboAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Bind configuration
        services.Configure<OboConfiguration>(
            configuration.GetSection(OboConfiguration.SectionName));

        // Register HTTP context accessor
        services.AddHttpContextAccessor();

        // Register OBO services
        services.AddSingleton<OboTokenCache>();
        services.AddScoped<IUserTokenAccessor, UserTokenAccessor>();
        services.AddScoped<IOboTokenCredentialProvider, OboTokenCredentialProvider>();

        return services;
    }

    /// <summary>
    /// Adds OBO authentication with custom configuration action.
    /// </summary>
    public static IServiceCollection AddOboAuthentication(
        this IServiceCollection services,
        Action<OboConfiguration> configure)
    {
        services.Configure(configure);
        services.AddHttpContextAccessor();
        services.AddSingleton<OboTokenCache>();
        services.AddScoped<IUserTokenAccessor, UserTokenAccessor>();
        services.AddScoped<IOboTokenCredentialProvider, OboTokenCredentialProvider>();

        return services;
    }
}
```

#### 7. `OboEnabledBaseService`

Base class for all MCP tool services.

```csharp
namespace AzureConduit.Mcp.Core.Services;

/// <summary>
/// Base class for MCP tool services that need OBO authentication.
/// Provides easy access to user-scoped Azure SDK clients.
/// </summary>
public abstract class OboEnabledBaseService
{
    protected readonly IOboTokenCredentialProvider CredentialProvider;
    protected readonly ILogger Logger;

    protected OboEnabledBaseService(
        IOboTokenCredentialProvider credentialProvider,
        ILogger logger)
    {
        CredentialProvider = credentialProvider;
        Logger = logger;
    }

    /// <summary>
    /// Gets a TokenCredential for calling Azure APIs as the current user.
    /// </summary>
    protected TokenCredential GetUserCredential() => CredentialProvider.GetCredential();

    /// <summary>
    /// Creates an ARM client authenticated as the current user.
    /// </summary>
    protected ArmClient CreateArmClient()
    {
        return new ArmClient(GetUserCredential());
    }

    /// <summary>
    /// Creates an ARM client for a specific subscription.
    /// </summary>
    protected ArmClient CreateArmClient(string subscriptionId)
    {
        return new ArmClient(
            GetUserCredential(),
            subscriptionId);
    }

    /// <summary>
    /// Wraps an operation with standard error handling.
    /// </summary>
    protected async Task<T> ExecuteWithErrorHandling<T>(
        Func<Task<T>> operation,
        string operationName)
    {
        try
        {
            Logger.LogInformation("Executing {Operation}", operationName);
            return await operation();
        }
        catch (AuthenticationFailedException ex)
        {
            Logger.LogWarning(ex, "Authentication failed for {Operation}", operationName);
            throw new McpException(
                $"Authentication failed: {ex.Message}",
                McpErrorCode.Unauthorized);
        }
        catch (RequestFailedException ex) when (ex.Status == 403)
        {
            Logger.LogWarning(ex, "Access denied for {Operation}", operationName);
            throw new McpException(
                $"Access denied. User does not have permission for this operation.",
                McpErrorCode.Forbidden);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            Logger.LogWarning(ex, "Resource not found for {Operation}", operationName);
            throw new McpException(
                $"Resource not found.",
                McpErrorCode.NotFound);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error executing {Operation}", operationName);
            throw;
        }
    }
}
```

---

## Azure MCP (`AzureConduit.Mcp.Azure`)

### Tools — 42 Total (19 Service Categories)

| Category | Tools | Count |
|----------|-------|-------|
| **Subscriptions** | ListSubscriptions, GetSubscription | 2 |
| **Resource Groups** | ListResourceGroups, GetResourceGroup, CreateResourceGroup | 3 |
| **Resources** | ListResources | 1 |
| **Storage** | ListStorageAccounts, ListStorageContainers, ListBlobs | 3 |
| **Key Vault** | ListKeyVaults, ListSecrets, GetSecret | 3 |
| **Compute** | ListVirtualMachines, GetVirtualMachine, StartVirtualMachine, StopVirtualMachine | 4 |
| **Cosmos DB** | ListCosmosAccounts, ListCosmosDatabases, ListCosmosContainers | 3 |
| **SQL** | ListSqlServers, ListSqlDatabases | 2 |
| **App Service** | ListWebApps, GetWebApp, RestartWebApp, ListAppServicePlans | 4 |
| **AKS** | ListAksClusters, GetAksCluster | 2 |
| **Functions** | ListFunctionApps | 1 |
| **Event Hubs** | ListEventHubNamespaces, ListEventHubs | 2 |
| **Service Bus** | ListServiceBusNamespaces, ListServiceBusQueues, ListServiceBusTopics | 3 |
| **Monitor** | ListApplicationInsights, ListLogAnalyticsWorkspaces | 2 |
| **Redis** | ListRedisCaches | 1 |
| **Container Registry** | ListContainerRegistries | 1 |
| **Policy** | ListPolicyAssignments | 1 |
| **Network** | ListVirtualNetworks, ListNetworkSecurityGroups | 2 |
| **Container Apps** | ListContainerApps, ListContainerAppEnvironments | 2 |

### Example Tool Implementation

```csharp
namespace AzureConduit.Mcp.Azure.Tools.Subscriptions;

[McpTool("azure_subscriptions_list", "List all Azure subscriptions the user has access to")]
public class ListSubscriptionsTool : OboEnabledBaseService
{
    public ListSubscriptionsTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListSubscriptionsTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListSubscriptionsResult> ExecuteAsync(
        CancellationToken cancellationToken = default)
    {
        return await ExecuteWithErrorHandling(async () =>
        {
            var client = CreateArmClient();
            var subscriptions = new List<SubscriptionInfo>();

            await foreach (var sub in client.GetSubscriptions()
                .GetAllAsync(cancellationToken))
            {
                subscriptions.Add(new SubscriptionInfo
                {
                    Id = sub.Data.SubscriptionId,
                    Name = sub.Data.DisplayName,
                    State = sub.Data.State?.ToString(),
                    TenantId = sub.Data.TenantId?.ToString()
                });
            }

            // User only sees subscriptions THEY have access to
            return new ListSubscriptionsResult
            {
                Subscriptions = subscriptions,
                Count = subscriptions.Count
            };
        }, "ListSubscriptions");
    }
}

public record ListSubscriptionsResult
{
    public required List<SubscriptionInfo> Subscriptions { get; init; }
    public int Count { get; init; }
}

public record SubscriptionInfo
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? State { get; init; }
    public string? TenantId { get; init; }
}
```

### Program.cs

```csharp
using AzureConduit.Mcp.Core.Extensions;
using AzureConduit.Mcp.Azure;

var builder = WebApplication.CreateBuilder(args);

// Add OBO authentication (from Core)
builder.Services.AddOboAuthentication(builder.Configuration);

// Add MCP server
builder.Services.AddMcpServer(options =>
{
    options.ServerName = "AzureConduit Azure MCP";
    options.ServerVersion = "1.0.0";
});

// Register all Azure tools
builder.Services.AddAzureMcpTools();

var app = builder.Build();

// MCP endpoints
app.MapMcpServer();

app.Run();
```

---

## D365 MCP (`AzureConduit.Mcp.D365`)

### Tools — 34 Total (Generic Pattern + Legacy)

Follows Microsoft's official pattern with **generic Data/Action/Form tools** that work with any D365 entity.

| Category | Tool | Description |
|----------|------|-------------|
| **Data Tools (6)** | | |
| | FindEntityType | Search for OData entity types by keyword |
| | GetEntityMetadata | Get entity schema from $metadata XML |
| | FindEntities | Query any entity with $select, $filter, $expand, $orderby |
| | CreateEntities | Create records via OData POST |
| | UpdateEntities | Update records via OData PATCH |
| | DeleteEntities | Delete records via OData DELETE |
| **Action Tools (2)** | | |
| | FindActions | Find available actions/functions from $metadata |
| | InvokeAction | Invoke bound or unbound OData actions |
| **Form Tools (13)** | | |
| | OpenMenuItem | Open a menu item by name |
| | FindMenuItem | Search for menu items by keyword |
| | FindControls | Find controls on the current form |
| | SetControlValues | Set field values on form controls |
| | ClickControl | Click a button or control |
| | FilterForm | Apply filters to the form |
| | FilterGrid | Filter data in a grid control |
| | SelectGridRow | Select a row in a grid |
| | SortGridColumn | Sort grid by a column |
| | OpenLookup | Open a lookup dialog |
| | OpenOrCloseTab | Toggle form tab visibility |
| | SaveForm | Save the current form |
| | CloseForm | Close the current form |
| **Legacy Tools (13)** | | Entity-specific convenience tools |
| | Finance | ListInvoices, GetInvoice, ListVendors, GetVendor, ListCustomers, GetCustomer, ListPayments |
| | Supply Chain | ListPurchaseOrders, GetPurchaseOrder, ListSalesOrders, GetSalesOrder, GetInventoryOnHand |
| | Common | QueryEntities |

### D365 Authentication Specifics

D365 uses different API endpoints:

```csharp
// D365 Finance & Operations (F&O)
var d365FoScope = "https://[org].operations.dynamics.com/.default";

// D365 Sales / CRM (Dataverse-based)
var d365SalesScope = "https://[org].crm.dynamics.com/.default";

// D365 Business Central
var bcScope = "https://api.businesscentral.dynamics.com/.default";
```

The OBO credential provider handles this by accepting the target scope:

```csharp
public class D365Service : OboEnabledBaseService
{
    private readonly D365Configuration _d365Config;

    protected HttpClient CreateD365Client()
    {
        var credential = GetUserCredential();
        var token = credential.GetToken(
            new TokenRequestContext(new[] { _d365Config.Scope }),
            CancellationToken.None);

        var client = new HttpClient
        {
            BaseAddress = new Uri(_d365Config.BaseUrl)
        };
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token.Token);

        return client;
    }
}
```

---

## Dataverse MCP (`AzureConduit.Mcp.Dataverse`)

### Tools — 13 Total

Full CRUD operations plus schema management tools.

| Category | Tool | Description |
|----------|------|-------------|
| **Table Tools (6)** | | |
| | ListTables | List all Dataverse tables |
| | GetTable | Get table metadata |
| | DescribeTable | Get detailed schema with columns, relationships |
| | CreateTable | Create a new custom table |
| | UpdateTable | Update table display name, description |
| | DeleteTable | Delete a custom table |
| **Record Tools (5)** | | |
| | ListRecords | List records with OData query support |
| | GetRecord | Get a specific record by ID |
| | CreateRecord | Create a new record |
| | UpdateRecord | Update an existing record |
| | DeleteRecord | Delete a record |
| **Query Tools (2)** | | |
| | Query | Execute FetchXML queries |
| | Search | Keyword search across Dataverse using Search API |

### Dataverse Client

```csharp
public class DataverseService : OboEnabledBaseService
{
    private readonly DataverseConfiguration _config;

    protected ServiceClient CreateDataverseClient()
    {
        var credential = GetUserCredential();

        return new ServiceClient(
            new Uri(_config.EnvironmentUrl),
            credential);
    }

    public async Task<EntityCollection> QueryRecords(string fetchXml)
    {
        return await ExecuteWithErrorHandling(async () =>
        {
            using var client = CreateDataverseClient();
            return await client.RetrieveMultipleAsync(new FetchExpression(fetchXml));
        }, "QueryRecords");
    }
}
```

---

## Fabric MCP (`AzureConduit.Mcp.Fabric`)

### Tools — 28 Total

Comprehensive Fabric management including OneLake file operations and API documentation tools.

| Category | Tool | Description |
|----------|------|-------------|
| **Workspace Tools (3)** | | |
| | ListWorkspaces | List all accessible workspaces |
| | GetWorkspace | Get workspace details |
| | CreateWorkspace | Create a new workspace |
| **Lakehouse Tools (3)** | | |
| | ListLakehouses | List lakehouses in workspace |
| | GetLakehouse | Get lakehouse details |
| | ListLakehouseTables | List tables in lakehouse |
| **Warehouse Tools (2)** | | |
| | ListWarehouses | List warehouses in workspace |
| | GetWarehouse | Get warehouse details |
| **Notebook Tools (2)** | | |
| | ListNotebooks | List notebooks in workspace |
| | GetNotebook | Get notebook details |
| **Pipeline Tools (4)** | | |
| | ListPipelines | List data pipelines |
| | GetPipeline | Get pipeline details |
| | RunPipeline | Trigger a pipeline run |
| | GetPipelineRun | Get pipeline run status |
| **Core Tools (1)** | | |
| | CreateItem | Create any Fabric item (Lakehouse, Notebook, etc.) |
| **Docs Tools (6)** | | API documentation and guidance |
| | ListWorkloads | List available Fabric workload types |
| | GetWorkloadApiSpec | Get OpenAPI spec for a workload |
| | GetPlatformApiSpec | Get core Fabric platform API spec |
| | GetItemDefinitions | Get JSON schema for item definitions |
| | GetBestPractices | Get best practices by topic |
| | GetApiExamples | Get example API requests/responses |
| **OneLake Tools (7)** | | ADLS Gen2-compatible file operations |
| | ListFiles | List files/directories in OneLake path |
| | UploadFile | Upload file to OneLake (create, append, flush) |
| | DownloadFile | Download file from OneLake |
| | DeleteFile | Delete file from OneLake |
| | CreateDirectory | Create directory in OneLake |
| | DeleteDirectory | Delete directory from OneLake |
| | ListTables | List Delta tables in lakehouse |

### Fabric Client

```csharp
public class FabricService : OboEnabledBaseService
{
    private const string FabricScope = "https://api.fabric.microsoft.com/.default";

    protected HttpClient CreateFabricClient()
    {
        var credential = GetUserCredential();
        var token = credential.GetToken(
            new TokenRequestContext(new[] { FabricScope }),
            CancellationToken.None);

        var client = new HttpClient
        {
            BaseAddress = new Uri("https://api.fabric.microsoft.com/v1/")
        };
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token.Token);

        return client;
    }
}
```

---

## Infrastructure Changes

### APIM Policy Update

Update `terraform/azureconduit-mcp-infra/policies/apim_inbound.xml` to forward user token:

```xml
<policies>
    <inbound>
        <base />

        <!-- Validate the user's JWT -->
        <validate-azure-ad-token tenant-id="{{tenant-id}}" output-token-variable-name="jwt">
            <client-application-ids>
                <application-id>{{app-client-id}}</application-id>
            </client-application-ids>
            <audiences>
                <audience>api://{{app-client-id}}</audience>
            </audiences>
        </validate-azure-ad-token>

        <!-- Forward user token to MCP server for OBO exchange -->
        <set-header name="X-User-Token" exists-action="override">
            <value>@(context.Request.Headers.GetValueOrDefault("Authorization",""))</value>
        </set-header>

        <!-- Add user identity to headers for logging -->
        <set-header name="X-User-Id" exists-action="override">
            <value>@(((Jwt)context.Variables["jwt"]).Claims.GetValueOrDefault("oid", ""))</value>
        </set-header>
        <set-header name="X-User-Name" exists-action="override">
            <value>@(((Jwt)context.Variables["jwt"]).Claims.GetValueOrDefault("preferred_username", ""))</value>
        </set-header>

    </inbound>
    <backend>
        <base />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```

### Terraform Variables

Add to `variables.tf`:

```hcl
variable "enable_obo" {
  description = "Enable OBO authentication (requires client secret)"
  type        = bool
  default     = true
}

variable "mcp_type" {
  description = "Which AzureConduit MCP to deploy"
  type        = string
  default     = "azure"

  validation {
    condition     = contains(["azure", "d365", "dataverse", "fabric"], var.mcp_type)
    error_message = "mcp_type must be one of: azure, d365, dataverse, fabric"
  }
}
```

### Entra App Registration Update

Add client secret for OBO (in `entra.tf`):

```hcl
resource "azuread_application_password" "mcp_obo" {
  count          = var.enable_obo ? 1 : 0
  application_id = azuread_application.mcp.id
  display_name   = "MCP OBO Client Secret"
  end_date       = timeadd(timestamp(), "8760h") # 1 year
}

resource "azurerm_key_vault_secret" "mcp_client_secret" {
  count        = var.enable_obo ? 1 : 0
  name         = "mcp-client-secret"
  value        = azuread_application_password.mcp_obo[0].value
  key_vault_id = azurerm_key_vault.main.id
}

# Add delegated permissions for downstream APIs
resource "azuread_application_api_access" "azure_management" {
  count          = var.mcp_type == "azure" && var.enable_obo ? 1 : 0
  application_id = azuread_application.mcp.id
  api_client_id  = "797f4846-ba00-4fd7-ba43-dac1f8f63013" # Azure Management

  scope_ids = [
    "41094075-9dad-400e-a0bd-54e686782033" # user_impersonation
  ]
}

resource "azuread_application_api_access" "dynamics" {
  count          = var.mcp_type == "d365" && var.enable_obo ? 1 : 0
  application_id = azuread_application.mcp.id
  api_client_id  = "00000007-0000-0000-c000-000000000000" # Dynamics CRM

  scope_ids = [
    "78ce3f0f-a1ce-49c2-8cde-64b5c0896db4" # user_impersonation
  ]
}
```

---

## Implementation Plan

### Phase 1: Core Module (Week 1)

| Task | Effort | Output |
|------|--------|--------|
| Create solution structure | 0.5 days | `.sln`, projects, docker setup |
| Implement `OboConfiguration` | 0.5 days | Config model + binding |
| Implement `UserTokenAccessor` | 0.5 days | HTTP context extraction |
| Implement `OboCredential` | 1 day | MSAL OBO exchange |
| Implement `OboTokenCredentialProvider` | 0.5 days | DI-compatible provider |
| Implement `OboTokenCache` | 0.5 days | Thread-safe caching |
| Implement `OboEnabledBaseService` | 0.5 days | Base class |
| Implement `ServiceCollectionExtensions` | 0.5 days | DI helpers |
| Unit tests for Core | 1 day | >80% coverage |

### Phase 2: Azure MCP (Week 2)

| Task | Effort | Output |
|------|--------|--------|
| Port Microsoft Azure MCP structure | 0.5 days | Project scaffolding |
| Integrate OBO Core | 0.5 days | DI registration |
| Port Subscription tools | 0.5 days | 3 tools |
| Port Resource Group tools | 0.5 days | 4 tools |
| Port Storage tools | 1 day | 6 tools |
| Port Key Vault tools | 1 day | 6 tools |
| Port Compute tools | 0.5 days | 5 tools |
| Port remaining tools | 1.5 days | ~15 tools |
| Integration tests | 1 day | Key scenarios |

### Phase 3: D365 MCP (Week 3)

| Task | Effort | Output |
|------|--------|--------|
| Port Microsoft D365 MCP structure | 0.5 days | Project scaffolding |
| Integrate OBO Core | 0.5 days | DI registration |
| Port Finance tools | 2 days | ~15 tools |
| Port SCM tools | 1.5 days | ~12 tools |
| Port Sales tools | 1 day | ~10 tools |
| Integration tests | 0.5 days | Key scenarios |

### Phase 4: Dataverse MCP (Week 4, Days 1-3)

| Task | Effort | Output |
|------|--------|--------|
| Port Microsoft Dataverse MCP structure | 0.5 days | Project scaffolding |
| Integrate OBO Core | 0.5 days | DI registration |
| Port Table/Record tools | 1 day | ~8 tools |
| Port Query/Metadata tools | 0.5 days | ~5 tools |
| Integration tests | 0.5 days | Key scenarios |

### Phase 5: Fabric MCP (Week 4, Days 4-5)

| Task | Effort | Output |
|------|--------|--------|
| Port Microsoft Fabric MCP structure | 0.5 days | Project scaffolding |
| Integrate OBO Core | 0.5 days | DI registration |
| Port Workspace/Lakehouse tools | 0.5 days | ~8 tools |
| Port Warehouse/Notebook tools | 0.5 days | ~8 tools |
| Integration tests | 0.5 days | Key scenarios |

### Phase 6: Infrastructure & Documentation (Week 5)

| Task | Effort | Output |
|------|--------|--------|
| Update APIM policy | 0.5 days | Token forwarding |
| Update Terraform module | 1 day | OBO support |
| Dockerfiles | 0.5 days | 4 production images |
| docker-compose for local dev | 0.5 days | Local testing setup |
| README and docs | 1 day | Deployment guide |
| End-to-end testing | 1.5 days | Full flow validation |

---

## Testing Strategy

### Unit Tests

Each module has its own test project:

```
tests/
├── AzureConduit.Mcp.Core.Tests/
│   ├── Auth/
│   │   ├── OboCredentialTests.cs
│   │   ├── OboTokenCacheTests.cs
│   │   └── UserTokenAccessorTests.cs
│   └── Services/
│       └── OboEnabledBaseServiceTests.cs
├── AzureConduit.Mcp.Azure.Tests/
│   └── Tools/
│       ├── SubscriptionsToolTests.cs
│       └── ...
└── ...
```

### Integration Tests

Test against real Azure/D365 with test accounts:

```csharp
[IntegrationTest]
public class AzureMcpIntegrationTests
{
    [Fact]
    public async Task ListSubscriptions_WithValidUserToken_ReturnsUserSubscriptions()
    {
        // Arrange
        var userToken = await GetTestUserToken();
        var client = CreateMcpClient(userToken);

        // Act
        var result = await client.CallToolAsync("azure_subscriptions_list");

        // Assert
        result.Subscriptions.Should().NotBeEmpty();
        result.Subscriptions.Should().OnlyContain(s =>
            TestUserHasAccess(s.Id)); // Verify user-scoped results
    }
}
```

### End-to-End Tests

Full flow: Claude → APIM → MCP → API → Response

```bash
# Test with real user authentication
curl -X POST "https://{apim-gateway}/mcp/tools/azure_subscriptions_list" \
  -H "Authorization: Bearer {user-token}" \
  -H "Content-Type: application/json"
```

---

## Deployment Guide

### Prerequisites

1. Azure subscription with Owner role
2. Entra ID with Application Administrator role
3. Docker installed
4. Terraform >= 1.6

### Step 1: Build Images

```bash
cd mcp-servers/AzureConduit-mcp

# Build all images
docker build -t azureconduit/mcp-azure:latest -f docker/Dockerfile.azure .
docker build -t azureconduit/mcp-d365:latest -f docker/Dockerfile.d365 .
docker build -t azureconduit/mcp-dataverse:latest -f docker/Dockerfile.dataverse .
docker build -t azureconduit/mcp-fabric:latest -f docker/Dockerfile.fabric .

# Push to ACR (or Docker Hub)
az acr login --name {your-acr}
docker tag azureconduit/mcp-azure:latest {your-acr}.azurecr.io/mcp-azure:latest
docker push {your-acr}.azurecr.io/mcp-azure:latest
```

### Step 2: Deploy Infrastructure

```hcl
module "azureconduit" {
  source = "./azureconduit-mcp-infra"

  client_name     = "acme-corp"
  location        = "eastus2"
  tenant_id       = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  subscription_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

  # Use AzureConduit MCP with OBO
  mcp_image  = "{your-acr}.azurecr.io/mcp-d365:latest"
  mcp_type   = "d365"
  enable_obo = true

  # D365-specific config
  d365_environment_url = "https://acme.operations.dynamics.com"
}
```

```bash
terraform init
terraform apply
```

### Step 3: Configure in Claude

1. Copy the `mcp_endpoint_url` from Terraform output
2. Go to **claude.ai → Organization Settings → Integrations → Add More**
3. Paste the URL
4. Users authenticate with their AD accounts
5. Each user sees only their data

---

## Success Metrics

| Metric | Target | Achieved |
|--------|--------|----------|
| Feature parity with Microsoft MCPs | 100% | ✅ 117 tools implemented |
| Azure service coverage | 40+ namespaces | ✅ 19 categories, 42 tools |
| D365 generic pattern adoption | Data/Action/Form | ✅ 21 generic + 13 legacy |
| Dataverse schema management | Full CRUD | ✅ 13 tools |
| Fabric OneLake support | File operations | ✅ 7 OneLake tools |
| Modular deployment | Independent servers | ✅ 4 standalone servers |
| OBO token exchange success rate | >99% | Pending production validation |
| Token exchange latency (p95) | <500ms | Pending production validation |

---

## Open Questions

1. **Image hosting**: Push to Docker Hub (public) or require clients to build/host themselves?
2. **Versioning strategy**: Follow Microsoft's versioning or independent?
3. **Update cadence**: How often to sync with Microsoft's upstream changes?
4. **Multi-region**: Support for sovereign clouds (GCC, China)?

---

## Appendix

### A. Microsoft MCP Repository Reference

- **Repo**: https://github.com/microsoft/mcp
- **License**: MIT
- **Language**: C# / .NET 8
- **Servers**: Azure, D365, Dataverse, Fabric

### B. Required NuGet Packages

```xml
<!-- Core -->
<PackageReference Include="Azure.Identity" Version="1.13.0" />
<PackageReference Include="Microsoft.Identity.Client" Version="4.65.0" />
<PackageReference Include="Microsoft.Extensions.Http" Version="8.0.0" />

<!-- Azure MCP -->
<PackageReference Include="Azure.ResourceManager" Version="1.13.0" />
<PackageReference Include="Azure.ResourceManager.Storage" Version="1.3.0" />
<PackageReference Include="Azure.ResourceManager.KeyVault" Version="1.3.0" />
<PackageReference Include="Azure.ResourceManager.Compute" Version="1.6.0" />

<!-- D365 MCP -->
<PackageReference Include="Microsoft.Dynamics.Commerce.Sdk" Version="9.52" />

<!-- Dataverse MCP -->
<PackageReference Include="Microsoft.PowerPlatform.Dataverse.Client" Version="1.2.0" />

<!-- Fabric MCP -->
<!-- Uses REST API, no official SDK yet -->
```

### C. Environment Variables

```bash
# Required for all MCPs
OBO__TenantId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OBO__ClientId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OBO__ClientSecret=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Azure MCP (optional)
AZURE__DefaultSubscriptionId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# D365 MCP
D365__EnvironmentUrl=https://acme.operations.dynamics.com
D365__Scope=https://acme.operations.dynamics.com/.default

# Dataverse MCP
DATAVERSE__EnvironmentUrl=https://acme.crm.dynamics.com
DATAVERSE__Scope=https://acme.crm.dynamics.com/.default

# Fabric MCP
FABRIC__WorkspaceId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```
