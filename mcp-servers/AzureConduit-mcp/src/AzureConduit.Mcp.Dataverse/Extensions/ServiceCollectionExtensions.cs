namespace AzureConduit.Mcp.Dataverse.Extensions;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Tools;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddDataverseMcpTools(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<DataverseConfiguration>(configuration.GetSection(DataverseConfiguration.SectionName));
        services.AddHttpClient("Dataverse");
        // Record operations
        services.AddScoped<ListRecordsTool>();
        services.AddScoped<GetRecordTool>();
        services.AddScoped<CreateRecordTool>();
        services.AddScoped<UpdateRecordTool>();
        services.AddScoped<DeleteRecordTool>();
        services.AddScoped<QueryTool>();
        services.AddScoped<SearchTool>();

        // Table/Schema operations
        services.AddScoped<ListTablesTool>();
        services.AddScoped<GetTableTool>();
        services.AddScoped<DescribeTableTool>();
        services.AddScoped<CreateTableTool>();
        services.AddScoped<UpdateTableTool>();
        services.AddScoped<DeleteTableTool>();

        return services;
    }
}
