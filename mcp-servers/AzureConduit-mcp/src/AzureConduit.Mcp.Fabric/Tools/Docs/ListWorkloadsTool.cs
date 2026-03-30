namespace AzureConduit.Mcp.Fabric.Tools.Docs;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

/// <summary>
/// Lists Fabric workload types with public API specifications available
/// </summary>
public class ListWorkloadsTool : FabricBaseService
{
    public ListWorkloadsTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListWorkloadsTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public Task<ListWorkloadsResult> ExecuteAsync(CancellationToken ct = default)
    {
        // Fabric workload types with API specifications
        var workloads = new List<WorkloadInfo>
        {
            new() { Name = "Lakehouse", Description = "Delta Lake-based data lake storage", HasApiSpec = true },
            new() { Name = "Warehouse", Description = "SQL-based data warehouse", HasApiSpec = true },
            new() { Name = "Notebook", Description = "Interactive notebooks for data engineering", HasApiSpec = true },
            new() { Name = "DataPipeline", Description = "Data movement and orchestration", HasApiSpec = true },
            new() { Name = "Dataflow", Description = "Self-service data prep", HasApiSpec = true },
            new() { Name = "Report", Description = "Power BI reports", HasApiSpec = true },
            new() { Name = "Dashboard", Description = "Power BI dashboards", HasApiSpec = true },
            new() { Name = "Dataset", Description = "Power BI semantic models", HasApiSpec = true },
            new() { Name = "Eventstream", Description = "Real-time event processing", HasApiSpec = true },
            new() { Name = "KQLDatabase", Description = "Kusto Query Language databases", HasApiSpec = true },
            new() { Name = "MLModel", Description = "Machine learning models", HasApiSpec = true },
            new() { Name = "MLExperiment", Description = "ML experiments", HasApiSpec = true },
            new() { Name = "SparkJobDefinition", Description = "Spark job definitions", HasApiSpec = true }
        };

        return Task.FromResult(new ListWorkloadsResult { Workloads = workloads, Count = workloads.Count });
    }
}

public record ListWorkloadsResult
{
    public required List<WorkloadInfo> Workloads { get; init; }
    public int Count { get; init; }
}

public record WorkloadInfo
{
    public required string Name { get; init; }
    public required string Description { get; init; }
    public bool HasApiSpec { get; init; }
}
