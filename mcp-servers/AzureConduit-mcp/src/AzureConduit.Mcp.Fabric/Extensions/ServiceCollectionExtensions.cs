namespace AzureConduit.Mcp.Fabric.Extensions;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using AzureConduit.Mcp.Core.Extensions;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Tools;
using AzureConduit.Mcp.Fabric.Tools.Docs;
using AzureConduit.Mcp.Fabric.Tools.OneLake;
using AzureConduit.Mcp.Fabric.Tools.Core;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddFabricMcp(this IServiceCollection services, IConfiguration configuration)
    {
        // Add OBO authentication from Core
        services.AddOboAuthentication(configuration);

        // Add Fabric configuration
        services.Configure<FabricConfiguration>(
            configuration.GetSection(FabricConfiguration.SectionName));

        // Add HTTP client factories
        services.AddHttpClient("Fabric");
        services.AddHttpClient("OneLake");

        // ============ DOCS TOOLS (6 tools) ============
        services.AddScoped<ListWorkloadsTool>();
        services.AddScoped<GetWorkloadApiSpecTool>();
        services.AddScoped<GetPlatformApiSpecTool>();
        services.AddScoped<GetItemDefinitionsTool>();
        services.AddScoped<GetBestPracticesTool>();
        services.AddScoped<GetApiExamplesTool>();

        // ============ ONELAKE TOOLS (8 tools) ============
        services.AddScoped<ListFilesTool>();
        services.AddScoped<UploadFileTool>();
        services.AddScoped<DownloadFileTool>();
        services.AddScoped<DeleteFileTool>();
        services.AddScoped<CreateDirectoryTool>();
        services.AddScoped<DeleteDirectoryTool>();
        services.AddScoped<ListOneLakeTablesTool>();

        // ============ CORE TOOLS (1 tool) ============
        services.AddScoped<CreateItemTool>();

        // ============ WORKSPACE TOOLS ============
        services.AddScoped<ListWorkspacesTool>();
        services.AddScoped<GetWorkspaceTool>();
        services.AddScoped<CreateWorkspaceTool>();

        // ============ LAKEHOUSE TOOLS ============
        services.AddScoped<ListLakehousesTool>();
        services.AddScoped<GetLakehouseTool>();
        services.AddScoped<ListLakehouseTablesTool>();

        // ============ WAREHOUSE TOOLS ============
        services.AddScoped<ListWarehousesTool>();
        services.AddScoped<GetWarehouseTool>();

        // ============ NOTEBOOK TOOLS ============
        services.AddScoped<ListNotebooksTool>();
        services.AddScoped<GetNotebookTool>();

        // ============ PIPELINE TOOLS ============
        services.AddScoped<ListPipelinesTool>();
        services.AddScoped<GetPipelineTool>();
        services.AddScoped<RunPipelineTool>();
        services.AddScoped<GetPipelineRunTool>();

        return services;
    }
}
