namespace AzureConduit.Mcp.Azure.Tools.ResourceGroups;

using Azure.ResourceManager.Resources;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Creates a new resource group in a subscription.
/// Requires Contributor or Owner role on the subscription.
/// </summary>
public class CreateResourceGroupTool : OboEnabledBaseService
{
    public CreateResourceGroupTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<CreateResourceGroupTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<CreateResourceGroupResult> ExecuteAsync(
        string subscriptionId,
        string resourceGroupName,
        string location,
        Dictionary<string, string>? tags = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));
        if (string.IsNullOrWhiteSpace(resourceGroupName))
            throw new ArgumentException("Resource group name is required", nameof(resourceGroupName));
        if (string.IsNullOrWhiteSpace(location))
            throw new ArgumentException("Location is required", nameof(location));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);

            var rgData = new ResourceGroupData(location);

            if (tags != null)
            {
                foreach (var tag in tags)
                {
                    rgData.Tags.Add(tag.Key, tag.Value);
                }
            }

            var rgCollection = subscription.GetResourceGroups();
            var operation = await rgCollection.CreateOrUpdateAsync(
                Azure.WaitUntil.Completed,
                resourceGroupName,
                rgData,
                cancellationToken);

            var rg = operation.Value;

            Logger.LogInformation(
                "Created resource group {ResourceGroup} in {Location}",
                resourceGroupName,
                location);

            return new CreateResourceGroupResult
            {
                Id = rg.Data.Id.ToString(),
                Name = rg.Data.Name,
                Location = rg.Data.Location.Name,
                ProvisioningState = rg.Data.ProvisioningState,
                Created = true
            };
        }, "CreateResourceGroup", cancellationToken);
    }
}

public record CreateResourceGroupResult
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public string? ProvisioningState { get; init; }
    public bool Created { get; init; }
}
