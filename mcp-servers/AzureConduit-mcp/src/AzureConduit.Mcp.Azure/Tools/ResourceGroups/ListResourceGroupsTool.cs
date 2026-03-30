namespace AzureConduit.Mcp.Azure.Tools.ResourceGroups;

using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Lists all resource groups in a subscription that the user has access to.
/// </summary>
public class ListResourceGroupsTool : OboEnabledBaseService
{
    public ListResourceGroupsTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListResourceGroupsTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListResourceGroupsResult> ExecuteAsync(
        string subscriptionId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);
            var resourceGroups = new List<ResourceGroupInfo>();

            await foreach (var rg in subscription.GetResourceGroups().GetAllAsync(cancellationToken: cancellationToken))
            {
                resourceGroups.Add(new ResourceGroupInfo
                {
                    Name = rg.Data.Name,
                    Location = rg.Data.Location.Name,
                    ProvisioningState = rg.Data.ProvisioningState,
                    Tags = rg.Data.Tags?.ToDictionary(t => t.Key, t => t.Value)
                });
            }

            Logger.LogInformation(
                "Listed {Count} resource groups in subscription {SubscriptionId}",
                resourceGroups.Count,
                subscriptionId);

            return new ListResourceGroupsResult
            {
                SubscriptionId = subscriptionId,
                ResourceGroups = resourceGroups,
                Count = resourceGroups.Count
            };
        }, "ListResourceGroups", cancellationToken);
    }
}

public record ListResourceGroupsResult
{
    public required string SubscriptionId { get; init; }
    public required List<ResourceGroupInfo> ResourceGroups { get; init; }
    public int Count { get; init; }
}

public record ResourceGroupInfo
{
    public required string Name { get; init; }
    public required string Location { get; init; }
    public string? ProvisioningState { get; init; }
    public Dictionary<string, string>? Tags { get; init; }
}
