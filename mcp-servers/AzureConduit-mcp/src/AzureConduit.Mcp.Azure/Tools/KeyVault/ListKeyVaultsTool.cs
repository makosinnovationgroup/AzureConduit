namespace AzureConduit.Mcp.Azure.Tools.KeyVault;

using Azure.ResourceManager.KeyVault;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Lists all Key Vaults in a subscription that the user has access to.
/// </summary>
public class ListKeyVaultsTool : OboEnabledBaseService
{
    public ListKeyVaultsTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListKeyVaultsTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListKeyVaultsResult> ExecuteAsync(
        string subscriptionId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);
            var vaults = new List<KeyVaultInfo>();

            await foreach (var vault in subscription.GetKeyVaultsAsync(cancellationToken: cancellationToken))
            {
                vaults.Add(new KeyVaultInfo
                {
                    Id = vault.Data.Id.ToString(),
                    Name = vault.Data.Name,
                    ResourceGroup = ExtractResourceGroup(vault.Data.Id.ToString()),
                    Location = vault.Data.Location.Name,
                    VaultUri = vault.Data.Properties.VaultUri?.ToString(),
                    Sku = vault.Data.Properties.Sku?.Name?.ToString(),
                    EnableSoftDelete = vault.Data.Properties.EnableSoftDelete,
                    EnablePurgeProtection = vault.Data.Properties.EnablePurgeProtection,
                    EnableRbacAuthorization = vault.Data.Properties.EnableRbacAuthorization
                });
            }

            Logger.LogInformation(
                "Listed {Count} Key Vaults in subscription {SubscriptionId}",
                vaults.Count,
                subscriptionId);

            return new ListKeyVaultsResult
            {
                SubscriptionId = subscriptionId,
                KeyVaults = vaults,
                Count = vaults.Count
            };
        }, "ListKeyVaults", cancellationToken);
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

public record ListKeyVaultsResult
{
    public required string SubscriptionId { get; init; }
    public required List<KeyVaultInfo> KeyVaults { get; init; }
    public int Count { get; init; }
}

public record KeyVaultInfo
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? ResourceGroup { get; init; }
    public required string Location { get; init; }
    public string? VaultUri { get; init; }
    public string? Sku { get; init; }
    public bool? EnableSoftDelete { get; init; }
    public bool? EnablePurgeProtection { get; init; }
    public bool? EnableRbacAuthorization { get; init; }
}
