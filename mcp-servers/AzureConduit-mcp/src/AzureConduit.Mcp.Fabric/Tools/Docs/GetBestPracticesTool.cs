namespace AzureConduit.Mcp.Fabric.Tools.Docs;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

/// <summary>
/// Retrieve best practice documentation and guidance for specific topics
/// </summary>
public class GetBestPracticesTool : FabricBaseService
{
    public GetBestPracticesTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetBestPracticesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public Task<BestPracticesResult> ExecuteAsync(string topic, CancellationToken ct = default)
    {
        var practices = topic.ToLower() switch
        {
            "lakehouse" => GetLakehouseBestPractices(),
            "warehouse" => GetWarehouseBestPractices(),
            "security" => GetSecurityBestPractices(),
            "performance" => GetPerformanceBestPractices(),
            "onelake" => GetOneLakeBestPractices(),
            _ => GetGeneralBestPractices()
        };

        return Task.FromResult(new BestPracticesResult { Topic = topic, Practices = practices });
    }

    private static List<BestPractice> GetLakehouseBestPractices() => new()
    {
        new() { Title = "Use Delta format", Description = "Store data in Delta format for ACID transactions, time travel, and optimized performance" },
        new() { Title = "Partition large tables", Description = "Partition tables by date or other high-cardinality columns for better query performance" },
        new() { Title = "Optimize file sizes", Description = "Target 128MB-1GB file sizes for optimal read performance" },
        new() { Title = "Use V-Order", Description = "Enable V-Order optimization for better compression and query performance" }
    };

    private static List<BestPractice> GetWarehouseBestPractices() => new()
    {
        new() { Title = "Use appropriate data types", Description = "Choose the smallest data type that fits your data to optimize storage and performance" },
        new() { Title = "Create statistics", Description = "Ensure statistics are up-to-date for the query optimizer" },
        new() { Title = "Use result set caching", Description = "Enable result set caching for repeated queries" },
        new() { Title = "Avoid SELECT *", Description = "Select only the columns you need to reduce data movement" }
    };

    private static List<BestPractice> GetSecurityBestPractices() => new()
    {
        new() { Title = "Use workspace roles", Description = "Assign users to workspace roles (Admin, Member, Contributor, Viewer) based on least privilege" },
        new() { Title = "Enable sensitivity labels", Description = "Apply sensitivity labels to classify and protect data" },
        new() { Title = "Use OneLake data access roles", Description = "Configure fine-grained access control for OneLake data" },
        new() { Title = "Audit access", Description = "Enable and monitor audit logs for compliance" }
    };

    private static List<BestPractice> GetPerformanceBestPractices() => new()
    {
        new() { Title = "Right-size capacity", Description = "Choose the appropriate capacity SKU for your workload" },
        new() { Title = "Use caching", Description = "Leverage caching at all layers (query, semantic model, report)" },
        new() { Title = "Optimize DAX", Description = "Write efficient DAX queries and avoid expensive calculations" },
        new() { Title = "Monitor with Capacity Metrics", Description = "Use the Capacity Metrics app to monitor utilization" }
    };

    private static List<BestPractice> GetOneLakeBestPractices() => new()
    {
        new() { Title = "Use shortcuts", Description = "Create shortcuts to external data instead of copying data" },
        new() { Title = "Organize with folders", Description = "Use a consistent folder structure across workspaces" },
        new() { Title = "Enable mirroring", Description = "Use mirroring for real-time data replication from operational databases" }
    };

    private static List<BestPractice> GetGeneralBestPractices() => new()
    {
        new() { Title = "Use workspaces for isolation", Description = "Separate development, test, and production into different workspaces" },
        new() { Title = "Implement CI/CD", Description = "Use deployment pipelines for controlled releases" },
        new() { Title = "Document your data", Description = "Add descriptions and tags to items for discoverability" }
    };
}

public record BestPracticesResult
{
    public required string Topic { get; init; }
    public required List<BestPractice> Practices { get; init; }
}

public record BestPractice
{
    public required string Title { get; init; }
    public required string Description { get; init; }
}
