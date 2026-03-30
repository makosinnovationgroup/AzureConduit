namespace AzureConduit.Mcp.Azure.Tools.Subscriptions;

using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Lists all Azure subscriptions the authenticated user has access to.
/// Returns only subscriptions where the user has at least Reader role.
/// </summary>
public class ListSubscriptionsTool : OboEnabledBaseService
{
    public ListSubscriptionsTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListSubscriptionsTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListSubscriptionsResult> ExecuteAsync(CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var subscriptions = new List<SubscriptionInfo>();

            await foreach (var sub in client.GetSubscriptions().GetAllAsync(cancellationToken))
            {
                subscriptions.Add(new SubscriptionInfo
                {
                    Id = sub.Data.SubscriptionId,
                    Name = sub.Data.DisplayName,
                    State = sub.Data.State?.ToString() ?? "Unknown",
                    TenantId = sub.Data.TenantId?.ToString()
                });
            }

            Logger.LogInformation(
                "Listed {Count} subscriptions for user",
                subscriptions.Count);

            return new ListSubscriptionsResult
            {
                Subscriptions = subscriptions,
                Count = subscriptions.Count
            };
        }, "ListSubscriptions", cancellationToken);
    }
}

public record ListSubscriptionsResult
{
    public required List<SubscriptionInfo> Subscriptions { get; init; }
    public int Count { get; init; }
}

public record SubscriptionInfo
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string State { get; init; }
    public string? TenantId { get; init; }
}
