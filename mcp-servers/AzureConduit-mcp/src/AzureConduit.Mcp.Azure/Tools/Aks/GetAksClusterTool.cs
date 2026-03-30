namespace AzureConduit.Mcp.Azure.Tools.Aks;

using Azure.ResourceManager;
using Azure.ResourceManager.ContainerService;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class GetAksClusterTool : OboEnabledBaseService
{
    public GetAksClusterTool(IOboTokenCredentialProvider credentialProvider, ILogger<GetAksClusterTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<AksClusterDetails> ExecuteAsync(string subscriptionId, string resourceGroup, string clusterName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var cluster = await client.GetContainerServiceManagedClusterResource(
                ContainerServiceManagedClusterResource.CreateResourceIdentifier(subscriptionId, resourceGroup, clusterName)).GetAsync(ct);

            var data = cluster.Value.Data;
            var nodePools = data.AgentPoolProfiles?.Select(p => new AksNodePool
            {
                Name = p.Name ?? "",
                VmSize = p.VmSize ?? "",
                Count = p.Count ?? 0,
                Mode = p.Mode?.ToString() ?? ""
            }).ToList() ?? new();

            return new AksClusterDetails
            {
                Id = data.Id?.ToString() ?? "",
                Name = data.Name,
                Location = data.Location?.Name ?? "",
                KubernetesVersion = data.KubernetesVersion ?? "",
                PowerState = data.PowerState?.Code?.ToString() ?? "",
                Fqdn = data.Fqdn ?? "",
                NodeResourceGroup = data.NodeResourceGroup ?? "",
                DnsPrefix = data.DnsPrefix ?? "",
                NetworkPlugin = data.NetworkProfile?.NetworkPlugin?.ToString() ?? "",
                NodePools = nodePools
            };
        }, "GetAksCluster", ct);
    }
}

public record AksClusterDetails
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string KubernetesVersion { get; init; }
    public required string PowerState { get; init; }
    public required string Fqdn { get; init; }
    public required string NodeResourceGroup { get; init; }
    public required string DnsPrefix { get; init; }
    public required string NetworkPlugin { get; init; }
    public required List<AksNodePool> NodePools { get; init; }
}

public record AksNodePool
{
    public required string Name { get; init; }
    public required string VmSize { get; init; }
    public int Count { get; init; }
    public required string Mode { get; init; }
}
