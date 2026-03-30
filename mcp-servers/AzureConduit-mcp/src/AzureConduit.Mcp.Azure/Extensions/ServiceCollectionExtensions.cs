namespace AzureConduit.Mcp.Azure.Extensions;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using AzureConduit.Mcp.Core.Extensions;
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

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddAzureMcp(this IServiceCollection services, IConfiguration configuration)
    {
        // Add OBO authentication from Core
        services.AddOboAuthentication(configuration);

        // Subscription tools
        services.AddScoped<ListSubscriptionsTool>();
        services.AddScoped<GetSubscriptionTool>();

        // Resource Group tools
        services.AddScoped<ListResourceGroupsTool>();
        services.AddScoped<GetResourceGroupTool>();
        services.AddScoped<CreateResourceGroupTool>();

        // Resource tools
        services.AddScoped<ListResourcesTool>();

        // Storage tools
        services.AddScoped<ListStorageAccountsTool>();
        services.AddScoped<ListStorageContainersTool>();
        services.AddScoped<ListBlobsTool>();

        // Key Vault tools
        services.AddScoped<ListKeyVaultsTool>();
        services.AddScoped<ListSecretsTool>();
        services.AddScoped<GetSecretTool>();

        // Compute tools
        services.AddScoped<ListVirtualMachinesTool>();
        services.AddScoped<GetVirtualMachineTool>();
        services.AddScoped<StartVirtualMachineTool>();
        services.AddScoped<StopVirtualMachineTool>();

        // Cosmos DB tools
        services.AddScoped<ListCosmosAccountsTool>();
        services.AddScoped<ListCosmosDatabasesTool>();
        services.AddScoped<ListCosmosContainersTool>();

        // SQL Database tools
        services.AddScoped<ListSqlServersTool>();
        services.AddScoped<ListSqlDatabasesTool>();

        // App Service tools
        services.AddScoped<ListWebAppsTool>();
        services.AddScoped<GetWebAppTool>();
        services.AddScoped<RestartWebAppTool>();
        services.AddScoped<ListAppServicePlansTool>();

        // AKS tools
        services.AddScoped<ListAksClustersTool>();
        services.AddScoped<GetAksClusterTool>();

        // Functions tools
        services.AddScoped<ListFunctionAppsTool>();

        // Event Hubs tools
        services.AddScoped<ListEventHubNamespacesTool>();
        services.AddScoped<ListEventHubsTool>();

        // Service Bus tools
        services.AddScoped<ListServiceBusNamespacesTool>();
        services.AddScoped<ListServiceBusQueuesTool>();
        services.AddScoped<ListServiceBusTopicsTool>();

        // Monitor tools
        services.AddScoped<ListApplicationInsightsTool>();
        services.AddScoped<ListLogAnalyticsWorkspacesTool>();

        // Redis tools
        services.AddScoped<ListRedisCachesTool>();

        // Container Registry tools
        services.AddScoped<ListContainerRegistriesTool>();

        // Policy tools
        services.AddScoped<ListPolicyAssignmentsTool>();

        // Network tools
        services.AddScoped<ListVirtualNetworksTool>();
        services.AddScoped<ListNetworkSecurityGroupsTool>();

        // Container Apps tools
        services.AddScoped<ListContainerAppsTool>();
        services.AddScoped<ListContainerAppEnvironmentsTool>();

        return services;
    }
}
