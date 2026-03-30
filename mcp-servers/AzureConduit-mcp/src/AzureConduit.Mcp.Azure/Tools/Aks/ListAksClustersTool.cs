namespace AzureConduit.Mcp.Azure.Tools.Aks;

using Azure.ResourceManager;
using Azure.ResourceManager.ContainerService;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListAksClustersTool : OboEnabledBaseService
{
    public ListAksClustersTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListAksClustersTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListAksClustersResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var clusters = new List<AksClusterSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var cluster in rg.GetContainerServiceManagedClusters().GetAllAsync(ct))
                {
                    clusters.Add(MapCluster(cluster));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var cluster in sub.GetContainerServiceManagedClustersAsync(ct))
                {
                    clusters.Add(MapCluster(cluster));
                }
            }

            return new ListAksClustersResult { Clusters = clusters, Count = clusters.Count };
        }, "ListAksClusters", ct);
    }

    private static AksClusterSummary MapCluster(ContainerServiceManagedClusterResource cluster) => new()
    {
        Id = cluster.Id.ToString(),
        Name = cluster.Data.Name,
        Location = cluster.Data.Location?.Name ?? "",
        KubernetesVersion = cluster.Data.KubernetesVersion ?? "",
        PowerState = cluster.Data.PowerState?.Code?.ToString() ?? "",
        Fqdn = cluster.Data.Fqdn ?? "",
        NodeResourceGroup = cluster.Data.NodeResourceGroup ?? ""
    };
}

public record ListAksClustersResult
{
    public required List<AksClusterSummary> Clusters { get; init; }
    public int Count { get; init; }
}

public record AksClusterSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string KubernetesVersion { get; init; }
    public required string PowerState { get; init; }
    public required string Fqdn { get; init; }
    public required string NodeResourceGroup { get; init; }
}
