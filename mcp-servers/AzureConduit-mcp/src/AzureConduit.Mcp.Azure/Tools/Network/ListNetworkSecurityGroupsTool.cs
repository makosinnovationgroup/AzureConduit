namespace AzureConduit.Mcp.Azure.Tools.Network;

using Azure.ResourceManager;
using Azure.ResourceManager.Network;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListNetworkSecurityGroupsTool : OboEnabledBaseService
{
    public ListNetworkSecurityGroupsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListNetworkSecurityGroupsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListNsgsResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var nsgs = new List<NsgSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var nsg in rg.GetNetworkSecurityGroups().GetAllAsync(ct))
                {
                    nsgs.Add(MapNsg(nsg));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var nsg in sub.GetNetworkSecurityGroupsAsync(ct))
                {
                    nsgs.Add(MapNsg(nsg));
                }
            }

            return new ListNsgsResult { NetworkSecurityGroups = nsgs, Count = nsgs.Count };
        }, "ListNetworkSecurityGroups", ct);
    }

    private static NsgSummary MapNsg(NetworkSecurityGroupResource nsg) => new()
    {
        Id = nsg.Id.ToString(),
        Name = nsg.Data.Name,
        Location = nsg.Data.Location?.Name ?? "",
        SecurityRulesCount = nsg.Data.SecurityRules?.Count ?? 0,
        ProvisioningState = nsg.Data.ProvisioningState?.ToString() ?? ""
    };
}

public record ListNsgsResult
{
    public required List<NsgSummary> NetworkSecurityGroups { get; init; }
    public int Count { get; init; }
}

public record NsgSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public int SecurityRulesCount { get; init; }
    public required string ProvisioningState { get; init; }
}
