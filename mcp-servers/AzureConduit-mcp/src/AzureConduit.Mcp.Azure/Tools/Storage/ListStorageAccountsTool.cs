namespace AzureConduit.Mcp.Azure.Tools.Storage;

using Azure.ResourceManager.Storage;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Lists all storage accounts in a subscription that the user has access to.
/// </summary>
public class ListStorageAccountsTool : OboEnabledBaseService
{
    public ListStorageAccountsTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListStorageAccountsTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListStorageAccountsResult> ExecuteAsync(
        string subscriptionId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);
            var accounts = new List<StorageAccountInfo>();

            await foreach (var account in subscription.GetStorageAccountsAsync(cancellationToken))
            {
                accounts.Add(new StorageAccountInfo
                {
                    Id = account.Data.Id.ToString(),
                    Name = account.Data.Name,
                    ResourceGroup = ExtractResourceGroup(account.Data.Id.ToString()),
                    Location = account.Data.Location.Name,
                    Kind = account.Data.Kind?.ToString(),
                    Sku = account.Data.Sku?.Name?.ToString(),
                    PrimaryEndpoints = new StorageEndpoints
                    {
                        Blob = account.Data.PrimaryEndpoints?.BlobUri?.ToString(),
                        File = account.Data.PrimaryEndpoints?.FileUri?.ToString(),
                        Queue = account.Data.PrimaryEndpoints?.QueueUri?.ToString(),
                        Table = account.Data.PrimaryEndpoints?.TableUri?.ToString()
                    },
                    ProvisioningState = account.Data.ProvisioningState?.ToString(),
                    CreatedOn = account.Data.CreatedOn?.DateTime
                });
            }

            Logger.LogInformation(
                "Listed {Count} storage accounts in subscription {SubscriptionId}",
                accounts.Count,
                subscriptionId);

            return new ListStorageAccountsResult
            {
                SubscriptionId = subscriptionId,
                StorageAccounts = accounts,
                Count = accounts.Count
            };
        }, "ListStorageAccounts", cancellationToken);
    }

    private static string? ExtractResourceGroup(string resourceId)
    {
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

public record ListStorageAccountsResult
{
    public required string SubscriptionId { get; init; }
    public required List<StorageAccountInfo> StorageAccounts { get; init; }
    public int Count { get; init; }
}

public record StorageAccountInfo
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? ResourceGroup { get; init; }
    public required string Location { get; init; }
    public string? Kind { get; init; }
    public string? Sku { get; init; }
    public StorageEndpoints? PrimaryEndpoints { get; init; }
    public string? ProvisioningState { get; init; }
    public DateTime? CreatedOn { get; init; }
}

public record StorageEndpoints
{
    public string? Blob { get; init; }
    public string? File { get; init; }
    public string? Queue { get; init; }
    public string? Table { get; init; }
}
