namespace AzureConduit.Mcp.Azure.Tools.ResourceGroups;

using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Gets detailed information about a specific resource group.
/// </summary>
public class GetResourceGroupTool : OboEnabledBaseService
{
    public GetResourceGroupTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<GetResourceGroupTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ResourceGroupDetails> ExecuteAsync(
        string subscriptionId,
        string resourceGroupName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));
        if (string.IsNullOrWhiteSpace(resourceGroupName))
            throw new ArgumentException("Resource group name is required", nameof(resourceGroupName));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);
            var rgResponse = await subscription.GetResourceGroups()
                .GetAsync(resourceGroupName, cancellationToken);
            var rg = rgResponse.Value;

            Logger.LogInformation(
                "Retrieved resource group {ResourceGroup} in subscription {SubscriptionId}",
                resourceGroupName,
                subscriptionId);

            return new ResourceGroupDetails
            {
                Id = rg.Data.Id.ToString(),
                Name = rg.Data.Name,
                Location = rg.Data.Location.Name,
                ProvisioningState = rg.Data.ProvisioningState,
                ManagedBy = rg.Data.ManagedBy,
                Tags = rg.Data.Tags?.ToDictionary(t => t.Key, t => t.Value)
            };
        }, "GetResourceGroup", cancellationToken);
    }
}

public record ResourceGroupDetails
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public string? ProvisioningState { get; init; }
    public string? ManagedBy { get; init; }
    public Dictionary<string, string>? Tags { get; init; }
}
