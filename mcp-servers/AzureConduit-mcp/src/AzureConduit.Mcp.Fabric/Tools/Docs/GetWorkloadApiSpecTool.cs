namespace AzureConduit.Mcp.Fabric.Tools.Docs;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

/// <summary>
/// Retrieve OpenAPI specifications for specific Fabric workloads
/// </summary>
public class GetWorkloadApiSpecTool : FabricBaseService
{
    private static readonly Dictionary<string, string> WorkloadApiUrls = new()
    {
        ["Lakehouse"] = "lakehouses",
        ["Warehouse"] = "warehouses",
        ["Notebook"] = "notebooks",
        ["DataPipeline"] = "dataPipelines",
        ["Report"] = "reports",
        ["Dashboard"] = "dashboards",
        ["Dataset"] = "semanticModels",
        ["Eventstream"] = "eventstreams",
        ["KQLDatabase"] = "kqlDatabases",
        ["MLModel"] = "mlModels",
        ["MLExperiment"] = "mlExperiments"
    };

    public GetWorkloadApiSpecTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetWorkloadApiSpecTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public Task<WorkloadApiSpecResult> ExecuteAsync(string workloadType, CancellationToken ct = default)
    {
        if (!WorkloadApiUrls.TryGetValue(workloadType, out var apiPath))
        {
            throw new KeyNotFoundException($"Unknown workload type: {workloadType}");
        }

        // Return OpenAPI-style specification for the workload
        var spec = new WorkloadApiSpec
        {
            WorkloadType = workloadType,
            BasePath = $"/v1/workspaces/{{workspaceId}}/{apiPath}",
            Operations = GetOperationsForWorkload(workloadType, apiPath)
        };

        return Task.FromResult(new WorkloadApiSpecResult { Spec = spec });
    }

    private static List<ApiOperation> GetOperationsForWorkload(string workloadType, string apiPath)
    {
        return new List<ApiOperation>
        {
            new() { Method = "GET", Path = $"/{apiPath}", Description = $"List all {workloadType} items in workspace" },
            new() { Method = "GET", Path = $"/{apiPath}/{{itemId}}", Description = $"Get {workloadType} by ID" },
            new() { Method = "POST", Path = $"/{apiPath}", Description = $"Create new {workloadType}" },
            new() { Method = "PATCH", Path = $"/{apiPath}/{{itemId}}", Description = $"Update {workloadType}" },
            new() { Method = "DELETE", Path = $"/{apiPath}/{{itemId}}", Description = $"Delete {workloadType}" }
        };
    }
}

public record WorkloadApiSpecResult
{
    public required WorkloadApiSpec Spec { get; init; }
}

public record WorkloadApiSpec
{
    public required string WorkloadType { get; init; }
    public required string BasePath { get; init; }
    public required List<ApiOperation> Operations { get; init; }
}

public record ApiOperation
{
    public required string Method { get; init; }
    public required string Path { get; init; }
    public required string Description { get; init; }
}
