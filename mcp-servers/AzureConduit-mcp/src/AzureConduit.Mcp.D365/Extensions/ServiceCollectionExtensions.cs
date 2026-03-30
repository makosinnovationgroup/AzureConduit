namespace AzureConduit.Mcp.D365.Extensions;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using AzureConduit.Mcp.Core.Extensions;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Tools.Data;
using AzureConduit.Mcp.D365.Tools.Action;
using AzureConduit.Mcp.D365.Tools.Form;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddD365Mcp(this IServiceCollection services, IConfiguration configuration)
    {
        // Add OBO authentication from Core
        services.AddOboAuthentication(configuration);

        // Add D365 configuration
        services.Configure<D365Configuration>(
            configuration.GetSection(D365Configuration.SectionName));

        // Add HTTP client factories
        services.AddHttpClient("D365");
        services.AddHttpClient("D365Forms");

        // Register Data tools (6 tools - matches Microsoft's pattern)
        services.AddScoped<FindEntityTypeTool>();
        services.AddScoped<GetEntityMetadataTool>();
        services.AddScoped<FindEntitiesTool>();
        services.AddScoped<CreateEntitiesTool>();
        services.AddScoped<UpdateEntitiesTool>();
        services.AddScoped<DeleteEntitiesTool>();

        // Register Action tools (2 tools)
        services.AddScoped<FindActionsTool>();
        services.AddScoped<InvokeActionTool>();

        // Register Form tools (13 tools)
        services.AddScoped<OpenMenuItemTool>();
        services.AddScoped<FindMenuItemTool>();
        services.AddScoped<FindControlsTool>();
        services.AddScoped<SetControlValuesTool>();
        services.AddScoped<ClickControlTool>();
        services.AddScoped<FilterFormTool>();
        services.AddScoped<FilterGridTool>();
        services.AddScoped<SelectGridRowTool>();
        services.AddScoped<SortGridColumnTool>();
        services.AddScoped<OpenLookupTool>();
        services.AddScoped<OpenOrCloseTabTool>();
        services.AddScoped<SaveFormTool>();
        services.AddScoped<CloseFormTool>();

        return services;
    }
}
