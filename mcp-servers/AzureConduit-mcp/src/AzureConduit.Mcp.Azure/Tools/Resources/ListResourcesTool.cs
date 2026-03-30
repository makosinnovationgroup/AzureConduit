namespace AzureConduit.Mcp.Azure.Tools.Resources;

using Azure.ResourceManager.Resources;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Lists Azure resources in a subscription, optionally filtered by resource group or type.
/// </summary>
public class ListResourcesTool : OboEnabledBaseService
{
    public ListResourcesTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListResourcesTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListResourcesResult> ExecuteAsync(
        string subscriptionId,
        string? resourceGroupName = null,
        string? resourceType = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);
            var resources = new List<ResourceInfo>();

            // Build filter if resource type specified
            string? filter = null;
            if (!string.IsNullOrWhiteSpace(resourceType))
            {
                filter = $"resourceType eq '{resourceType}'";
            }

            if (!string.IsNullOrWhiteSpace(resourceGroupName))
            {
                // List resources in specific resource group
                var rg = await subscription.GetResourceGroups()
                    .GetAsync(resourceGroupName, cancellationToken);

                await foreach (var resource in rg.Value.GetGenericResourcesAsync(
                    filter: filter,
                    cancellationToken: cancellationToken))
                {
                    resources.Add(MapResource(resource.Data));
                    if (resources.Count >= 100) break; // Limit results
                }
            }
            else
            {
                // List all resources in subscription
                await foreach (var resource in subscription.GetGenericResourcesAsync(
                    filter: filter,
                    cancellationToken: cancellationToken))
                {
                    resources.Add(MapResource(resource.Data));
                    if (resources.Count >= 100) break; // Limit results
                }
            }

            Logger.LogInformation(
                "Listed {Count} resources in subscription {SubscriptionId}",
                resources.Count,
                subscriptionId);

            return new ListResourcesResult
            {
                SubscriptionId = subscriptionId,
                ResourceGroupName = resourceGroupName,
                ResourceTypeFilter = resourceType,
                Resources = resources,
                Count = resources.Count
            };
        }, "ListResources", cancellationToken);
    }

    private static ResourceInfo MapResource(GenericResourceData data)
    {
        return new ResourceInfo
        {
            Id = data.Id.ToString(),
            Name = data.Name,
            Type = data.ResourceType.ToString(),
            Location = data.Location?.Name,
            ResourceGroup = ExtractResourceGroup(data.Id.ToString()),
            ProvisioningState = data.ProvisioningState,
            Tags = data.Tags?.ToDictionary(t => t.Key, t => t.Value)
        };
    }

    private static string? ExtractResourceGroup(string resourceId)
    {
        // Extract resource group from resource ID
        // Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/...
        var parts = resourceId.Split('/');
        for (int i = 0; i < parts.Length - 1; i++)
        {
            if (parts[i].Equals("resourceGroups", StringComparison.OrdinalIgnoreCase))
            {
                return parts[i + 1];
            }
        }
        return null;
    }
}

public record ListResourcesResult
{
    public required string SubscriptionId { get; init; }
    public string? ResourceGroupName { get; init; }
    public string? ResourceTypeFilter { get; init; }
    public required List<ResourceInfo> Resources { get; init; }
    public int Count { get; init; }
}

public record ResourceInfo
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Type { get; init; }
    public string? Location { get; init; }
    public string? ResourceGroup { get; init; }
    public string? ProvisioningState { get; init; }
    public Dictionary<string, string>? Tags { get; init; }
}
