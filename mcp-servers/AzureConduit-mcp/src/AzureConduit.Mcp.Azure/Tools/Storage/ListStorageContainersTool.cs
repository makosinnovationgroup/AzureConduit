namespace AzureConduit.Mcp.Azure.Tools.Storage;

using Azure.ResourceManager.Storage;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Lists all blob containers in a storage account.
/// </summary>
public class ListStorageContainersTool : OboEnabledBaseService
{
    public ListStorageContainersTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListStorageContainersTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListContainersResult> ExecuteAsync(
        string subscriptionId,
        string resourceGroupName,
        string storageAccountName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));
        if (string.IsNullOrWhiteSpace(resourceGroupName))
            throw new ArgumentException("Resource group name is required", nameof(resourceGroupName));
        if (string.IsNullOrWhiteSpace(storageAccountName))
            throw new ArgumentException("Storage account name is required", nameof(storageAccountName));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);

            var rg = await subscription.GetResourceGroups()
                .GetAsync(resourceGroupName, cancellationToken);

            var storageAccount = await rg.Value.GetStorageAccounts()
                .GetAsync(storageAccountName, cancellationToken: cancellationToken);

            var blobService = await storageAccount.Value.GetBlobService()
                .GetAsync(cancellationToken);

            var containers = new List<ContainerInfo>();

            await foreach (var container in blobService.Value.GetBlobContainers()
                .GetAllAsync(cancellationToken: cancellationToken))
            {
                containers.Add(new ContainerInfo
                {
                    Name = container.Data.Name,
                    PublicAccess = container.Data.PublicAccess?.ToString() ?? "None",
                    LeaseState = container.Data.LeaseState?.ToString(),
                    LastModified = container.Data.LastModifiedOn?.DateTime,
                    HasImmutabilityPolicy = container.Data.HasImmutabilityPolicy,
                    HasLegalHold = container.Data.HasLegalHold
                });
            }

            Logger.LogInformation(
                "Listed {Count} containers in storage account {StorageAccount}",
                containers.Count,
                storageAccountName);

            return new ListContainersResult
            {
                StorageAccountName = storageAccountName,
                ResourceGroupName = resourceGroupName,
                Containers = containers,
                Count = containers.Count
            };
        }, "ListStorageContainers", cancellationToken);
    }
}

public record ListContainersResult
{
    public required string StorageAccountName { get; init; }
    public required string ResourceGroupName { get; init; }
    public required List<ContainerInfo> Containers { get; init; }
    public int Count { get; init; }
}

public record ContainerInfo
{
    public required string Name { get; init; }
    public required string PublicAccess { get; init; }
    public string? LeaseState { get; init; }
    public DateTime? LastModified { get; init; }
    public bool? HasImmutabilityPolicy { get; init; }
    public bool? HasLegalHold { get; init; }
}
