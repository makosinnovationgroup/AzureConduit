namespace AzureConduit.Mcp.Azure.Tools.Subscriptions;

using Azure.ResourceManager;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Gets detailed information about a specific Azure subscription.
/// </summary>
public class GetSubscriptionTool : OboEnabledBaseService
{
    public GetSubscriptionTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<GetSubscriptionTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<SubscriptionDetails> ExecuteAsync(
        string subscriptionId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);
            var data = subscription.Data;

            // Get locations available in this subscription
            var locations = new List<string>();
            await foreach (var location in subscription.GetLocationsAsync(cancellationToken: cancellationToken))
            {
                locations.Add(location.Name);
            }

            Logger.LogInformation(
                "Retrieved subscription {SubscriptionId}: {Name}",
                subscriptionId,
                data.DisplayName);

            return new SubscriptionDetails
            {
                Id = data.SubscriptionId,
                Name = data.DisplayName,
                State = data.State?.ToString() ?? "Unknown",
                TenantId = data.TenantId?.ToString(),
                SubscriptionPolicies = new SubscriptionPoliciesInfo
                {
                    LocationPlacementId = data.SubscriptionPolicies?.LocationPlacementId,
                    QuotaId = data.SubscriptionPolicies?.QuotaId,
                    SpendingLimit = data.SubscriptionPolicies?.SpendingLimit?.ToString()
                },
                AvailableLocations = locations.Take(20).ToList(), // Limit for readability
                Tags = data.Tags?.ToDictionary(t => t.Key, t => t.Value)
            };
        }, "GetSubscription", cancellationToken);
    }
}

public record SubscriptionDetails
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string State { get; init; }
    public string? TenantId { get; init; }
    public SubscriptionPoliciesInfo? SubscriptionPolicies { get; init; }
    public List<string>? AvailableLocations { get; init; }
    public Dictionary<string, string>? Tags { get; init; }
}

public record SubscriptionPoliciesInfo
{
    public string? LocationPlacementId { get; init; }
    public string? QuotaId { get; init; }
    public string? SpendingLimit { get; init; }
}
