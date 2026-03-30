namespace AzureConduit.Mcp.Azure.Tools.Network;

using Azure.ResourceManager;
using Azure.ResourceManager.Network;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListVirtualNetworksTool : OboEnabledBaseService
{
    public ListVirtualNetworksTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListVirtualNetworksTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListVirtualNetworksResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var vnets = new List<VirtualNetworkSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var vnet in rg.GetVirtualNetworks().GetAllAsync(ct))
                {
                    vnets.Add(MapVnet(vnet));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var vnet in sub.GetVirtualNetworksAsync(ct))
                {
                    vnets.Add(MapVnet(vnet));
                }
            }

            return new ListVirtualNetworksResult { VirtualNetworks = vnets, Count = vnets.Count };
        }, "ListVirtualNetworks", ct);
    }

    private static VirtualNetworkSummary MapVnet(VirtualNetworkResource vnet) => new()
    {
        Id = vnet.Id.ToString(),
        Name = vnet.Data.Name,
        Location = vnet.Data.Location?.Name ?? "",
        AddressSpace = vnet.Data.AddressSpace?.AddressPrefixes?.ToList() ?? new(),
        SubnetCount = vnet.Data.Subnets?.Count ?? 0,
        ProvisioningState = vnet.Data.ProvisioningState?.ToString() ?? ""
    };
}

public record ListVirtualNetworksResult
{
    public required List<VirtualNetworkSummary> VirtualNetworks { get; init; }
    public int Count { get; init; }
}

public record VirtualNetworkSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required List<string> AddressSpace { get; init; }
    public int SubnetCount { get; init; }
    public required string ProvisioningState { get; init; }
}
