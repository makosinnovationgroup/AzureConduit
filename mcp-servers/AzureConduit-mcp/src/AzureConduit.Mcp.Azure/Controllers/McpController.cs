namespace AzureConduit.Mcp.Azure.Controllers;

using Microsoft.AspNetCore.Mvc;
using AzureConduit.Mcp.Azure.Tools.Subscriptions;
using AzureConduit.Mcp.Azure.Tools.ResourceGroups;
using AzureConduit.Mcp.Azure.Tools.Resources;
using AzureConduit.Mcp.Azure.Tools.Storage;
using AzureConduit.Mcp.Azure.Tools.KeyVault;
using AzureConduit.Mcp.Azure.Tools.Compute;
using AzureConduit.Mcp.Azure.Tools.CosmosDb;
using AzureConduit.Mcp.Azure.Tools.Sql;
using AzureConduit.Mcp.Azure.Tools.AppService;
using AzureConduit.Mcp.Azure.Tools.Aks;
using AzureConduit.Mcp.Azure.Tools.Functions;
using AzureConduit.Mcp.Azure.Tools.EventHubs;
using AzureConduit.Mcp.Azure.Tools.ServiceBus;
using AzureConduit.Mcp.Azure.Tools.Monitor;
using AzureConduit.Mcp.Azure.Tools.Redis;
using AzureConduit.Mcp.Azure.Tools.ContainerRegistry;
using AzureConduit.Mcp.Azure.Tools.Policy;
using AzureConduit.Mcp.Azure.Tools.Network;
using AzureConduit.Mcp.Azure.Tools.ContainerApps;
using AzureConduit.Mcp.Core.Exceptions;

/// <summary>
/// MCP tool endpoints for Azure operations.
/// Each endpoint corresponds to an MCP tool that Claude can call.
/// </summary>
[ApiController]
[Route("tools")]
public class McpController : ControllerBase
{
    // ============================================================
    // Subscription Tools
    // ============================================================

    [HttpPost("azure_subscriptions_list")]
    public async Task<IActionResult> ListSubscriptions(
        [FromServices] ListSubscriptionsTool tool,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() => tool.ExecuteAsync(cancellationToken));
    }

    [HttpPost("azure_subscriptions_get")]
    public async Task<IActionResult> GetSubscription(
        [FromServices] GetSubscriptionTool tool,
        [FromBody] GetSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() => tool.ExecuteAsync(request.SubscriptionId, cancellationToken));
    }

    // ============================================================
    // Resource Group Tools
    // ============================================================

    [HttpPost("azure_resource_groups_list")]
    public async Task<IActionResult> ListResourceGroups(
        [FromServices] ListResourceGroupsTool tool,
        [FromBody] SubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() => tool.ExecuteAsync(request.SubscriptionId, cancellationToken));
    }

    [HttpPost("azure_resource_groups_get")]
    public async Task<IActionResult> GetResourceGroup(
        [FromServices] GetResourceGroupTool tool,
        [FromBody] ResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_resource_groups_create")]
    public async Task<IActionResult> CreateResourceGroup(
        [FromServices] CreateResourceGroupTool tool,
        [FromBody] CreateResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.Location, request.Tags, cancellationToken));
    }

    // ============================================================
    // Resource Tools
    // ============================================================

    [HttpPost("azure_resources_list")]
    public async Task<IActionResult> ListResources(
        [FromServices] ListResourcesTool tool,
        [FromBody] ListResourcesRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.ResourceType, cancellationToken));
    }

    // ============================================================
    // Storage Tools
    // ============================================================

    [HttpPost("azure_storage_accounts_list")]
    public async Task<IActionResult> ListStorageAccounts(
        [FromServices] ListStorageAccountsTool tool,
        [FromBody] SubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() => tool.ExecuteAsync(request.SubscriptionId, cancellationToken));
    }

    [HttpPost("azure_storage_containers_list")]
    public async Task<IActionResult> ListStorageContainers(
        [FromServices] ListStorageContainersTool tool,
        [FromBody] StorageAccountRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.StorageAccountName, cancellationToken));
    }

    [HttpPost("azure_storage_blobs_list")]
    public async Task<IActionResult> ListBlobs(
        [FromServices] ListBlobsTool tool,
        [FromBody] StorageContainerRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.StorageAccountName, request.ContainerName, cancellationToken));
    }

    // ============================================================
    // Key Vault Tools
    // ============================================================

    [HttpPost("azure_keyvault_list")]
    public async Task<IActionResult> ListKeyVaults(
        [FromServices] ListKeyVaultsTool tool,
        [FromBody] SubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() => tool.ExecuteAsync(request.SubscriptionId, cancellationToken));
    }

    [HttpPost("azure_keyvault_secrets_list")]
    public async Task<IActionResult> ListSecrets(
        [FromServices] ListSecretsTool tool,
        [FromBody] KeyVaultRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() => tool.ExecuteAsync(request.VaultUri, cancellationToken));
    }

    [HttpPost("azure_keyvault_secret_get")]
    public async Task<IActionResult> GetSecret(
        [FromServices] GetSecretTool tool,
        [FromBody] GetSecretRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() => tool.ExecuteAsync(request.VaultUri, request.SecretName, cancellationToken));
    }

    // ============================================================
    // Compute Tools
    // ============================================================

    [HttpPost("azure_compute_vms_list")]
    public async Task<IActionResult> ListVirtualMachines(
        [FromServices] ListVirtualMachinesTool tool,
        [FromBody] SubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() => tool.ExecuteAsync(request.SubscriptionId, cancellationToken));
    }

    [HttpPost("azure_compute_vm_get")]
    public async Task<IActionResult> GetVirtualMachine(
        [FromServices] GetVirtualMachineTool tool,
        [FromBody] VirtualMachineRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.VmName, cancellationToken));
    }

    [HttpPost("azure_compute_vm_start")]
    public async Task<IActionResult> StartVirtualMachine(
        [FromServices] StartVirtualMachineTool tool,
        [FromBody] VirtualMachineRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.VmName, cancellationToken));
    }

    [HttpPost("azure_compute_vm_stop")]
    public async Task<IActionResult> StopVirtualMachine(
        [FromServices] StopVirtualMachineTool tool,
        [FromBody] VirtualMachineRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.VmName, cancellationToken));
    }

    // ============================================================
    // Cosmos DB Tools
    // ============================================================

    [HttpPost("azure_cosmosdb_accounts_list")]
    public async Task<IActionResult> ListCosmosAccounts(
        [FromServices] ListCosmosAccountsTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_cosmosdb_databases_list")]
    public async Task<IActionResult> ListCosmosDatabases(
        [FromServices] ListCosmosDatabasesTool tool,
        [FromBody] CosmosAccountRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.AccountName, cancellationToken));
    }

    [HttpPost("azure_cosmosdb_containers_list")]
    public async Task<IActionResult> ListCosmosContainers(
        [FromServices] ListCosmosContainersTool tool,
        [FromBody] CosmosDatabaseRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.AccountName, request.DatabaseName, cancellationToken));
    }

    // ============================================================
    // SQL Tools
    // ============================================================

    [HttpPost("azure_sql_servers_list")]
    public async Task<IActionResult> ListSqlServers(
        [FromServices] ListSqlServersTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_sql_databases_list")]
    public async Task<IActionResult> ListSqlDatabases(
        [FromServices] ListSqlDatabasesTool tool,
        [FromBody] SqlServerRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.ServerName, cancellationToken));
    }

    // ============================================================
    // App Service Tools
    // ============================================================

    [HttpPost("azure_appservice_webapps_list")]
    public async Task<IActionResult> ListWebApps(
        [FromServices] ListWebAppsTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_appservice_webapp_get")]
    public async Task<IActionResult> GetWebApp(
        [FromServices] GetWebAppTool tool,
        [FromBody] WebAppRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.WebAppName, cancellationToken));
    }

    [HttpPost("azure_appservice_webapp_restart")]
    public async Task<IActionResult> RestartWebApp(
        [FromServices] RestartWebAppTool tool,
        [FromBody] WebAppRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.WebAppName, cancellationToken));
    }

    [HttpPost("azure_appservice_plans_list")]
    public async Task<IActionResult> ListAppServicePlans(
        [FromServices] ListAppServicePlansTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    // ============================================================
    // AKS Tools
    // ============================================================

    [HttpPost("azure_aks_clusters_list")]
    public async Task<IActionResult> ListAksClusters(
        [FromServices] ListAksClustersTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_aks_cluster_get")]
    public async Task<IActionResult> GetAksCluster(
        [FromServices] GetAksClusterTool tool,
        [FromBody] AksClusterRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.ClusterName, cancellationToken));
    }

    // ============================================================
    // Functions Tools
    // ============================================================

    [HttpPost("azure_functions_apps_list")]
    public async Task<IActionResult> ListFunctionApps(
        [FromServices] ListFunctionAppsTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    // ============================================================
    // Event Hubs Tools
    // ============================================================

    [HttpPost("azure_eventhubs_namespaces_list")]
    public async Task<IActionResult> ListEventHubNamespaces(
        [FromServices] ListEventHubNamespacesTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_eventhubs_list")]
    public async Task<IActionResult> ListEventHubs(
        [FromServices] ListEventHubsTool tool,
        [FromBody] EventHubNamespaceRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.NamespaceName, cancellationToken));
    }

    // ============================================================
    // Service Bus Tools
    // ============================================================

    [HttpPost("azure_servicebus_namespaces_list")]
    public async Task<IActionResult> ListServiceBusNamespaces(
        [FromServices] ListServiceBusNamespacesTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_servicebus_queues_list")]
    public async Task<IActionResult> ListServiceBusQueues(
        [FromServices] ListServiceBusQueuesTool tool,
        [FromBody] ServiceBusNamespaceRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.NamespaceName, cancellationToken));
    }

    [HttpPost("azure_servicebus_topics_list")]
    public async Task<IActionResult> ListServiceBusTopics(
        [FromServices] ListServiceBusTopicsTool tool,
        [FromBody] ServiceBusNamespaceRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, request.NamespaceName, cancellationToken));
    }

    // ============================================================
    // Monitor Tools
    // ============================================================

    [HttpPost("azure_monitor_appinsights_list")]
    public async Task<IActionResult> ListApplicationInsights(
        [FromServices] ListApplicationInsightsTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_monitor_loganalytics_list")]
    public async Task<IActionResult> ListLogAnalyticsWorkspaces(
        [FromServices] ListLogAnalyticsWorkspacesTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    // ============================================================
    // Redis Tools
    // ============================================================

    [HttpPost("azure_redis_caches_list")]
    public async Task<IActionResult> ListRedisCaches(
        [FromServices] ListRedisCachesTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    // ============================================================
    // Container Registry Tools
    // ============================================================

    [HttpPost("azure_acr_registries_list")]
    public async Task<IActionResult> ListContainerRegistries(
        [FromServices] ListContainerRegistriesTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    // ============================================================
    // Policy Tools
    // ============================================================

    [HttpPost("azure_policy_assignments_list")]
    public async Task<IActionResult> ListPolicyAssignments(
        [FromServices] ListPolicyAssignmentsTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    // ============================================================
    // Network Tools
    // ============================================================

    [HttpPost("azure_network_vnets_list")]
    public async Task<IActionResult> ListVirtualNetworks(
        [FromServices] ListVirtualNetworksTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_network_nsgs_list")]
    public async Task<IActionResult> ListNetworkSecurityGroups(
        [FromServices] ListNetworkSecurityGroupsTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    // ============================================================
    // Container Apps Tools
    // ============================================================

    [HttpPost("azure_containerapps_list")]
    public async Task<IActionResult> ListContainerApps(
        [FromServices] ListContainerAppsTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    [HttpPost("azure_containerapps_environments_list")]
    public async Task<IActionResult> ListContainerAppEnvironments(
        [FromServices] ListContainerAppEnvironmentsTool tool,
        [FromBody] OptionalResourceGroupRequest request,
        CancellationToken cancellationToken)
    {
        return await ExecuteToolAsync(() =>
            tool.ExecuteAsync(request.SubscriptionId, request.ResourceGroupName, cancellationToken));
    }

    // ============================================================
    // Helper Methods
    // ============================================================

    private async Task<IActionResult> ExecuteToolAsync<T>(Func<Task<T>> toolExecution)
    {
        try
        {
            var result = await toolExecution();
            return Ok(result);
        }
        catch (OboAuthenticationException ex) when (ex.RequiresInteraction)
        {
            return StatusCode(403, new
            {
                error = "interaction_required",
                message = ex.Message,
                claims = ex.Claims
            });
        }
        catch (OboAuthenticationException ex)
        {
            return Unauthorized(new
            {
                error = ex.ErrorCode ?? "authentication_failed",
                message = ex.Message
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new
            {
                error = "access_denied",
                message = ex.Message
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new
            {
                error = "not_found",
                message = ex.Message
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new
            {
                error = "invalid_argument",
                message = ex.Message
            });
        }
    }
}

// ============================================================
// Request Models
// ============================================================

public record SubscriptionRequest
{
    public required string SubscriptionId { get; init; }
}

public record GetSubscriptionRequest
{
    public required string SubscriptionId { get; init; }
}

public record ResourceGroupRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
}

public record CreateResourceGroupRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string Location { get; init; }
    public Dictionary<string, string>? Tags { get; init; }
}

public record ListResourcesRequest
{
    public required string SubscriptionId { get; init; }
    public string? ResourceGroupName { get; init; }
    public string? ResourceType { get; init; }
}

public record StorageAccountRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string StorageAccountName { get; init; }
}

public record StorageContainerRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string StorageAccountName { get; init; }
    public required string ContainerName { get; init; }
}

public record KeyVaultRequest
{
    public required string VaultUri { get; init; }
}

public record GetSecretRequest
{
    public required string VaultUri { get; init; }
    public required string SecretName { get; init; }
}

public record VirtualMachineRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string VmName { get; init; }
}

public record OptionalResourceGroupRequest
{
    public required string SubscriptionId { get; init; }
    public string? ResourceGroupName { get; init; }
}

public record CosmosAccountRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string AccountName { get; init; }
}

public record CosmosDatabaseRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string AccountName { get; init; }
    public required string DatabaseName { get; init; }
}

public record SqlServerRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string ServerName { get; init; }
}

public record WebAppRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string WebAppName { get; init; }
}

public record AksClusterRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string ClusterName { get; init; }
}

public record EventHubNamespaceRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string NamespaceName { get; init; }
}

public record ServiceBusNamespaceRequest
{
    public required string SubscriptionId { get; init; }
    public required string ResourceGroupName { get; init; }
    public required string NamespaceName { get; init; }
}
