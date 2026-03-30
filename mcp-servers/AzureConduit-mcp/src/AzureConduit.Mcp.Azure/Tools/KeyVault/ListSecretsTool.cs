namespace AzureConduit.Mcp.Azure.Tools.KeyVault;

using Azure.Security.KeyVault.Secrets;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Lists all secrets in a Key Vault.
/// Does not return secret values - only metadata.
/// </summary>
public class ListSecretsTool : OboEnabledBaseService
{
    public ListSecretsTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListSecretsTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListSecretsResult> ExecuteAsync(
        string vaultUri,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(vaultUri))
            throw new ArgumentException("Vault URI is required", nameof(vaultUri));

        return await ExecuteAsync(async () =>
        {
            var credential = GetUserCredential();
            var client = new SecretClient(new Uri(vaultUri), credential);
            var secrets = new List<SecretInfo>();

            await foreach (var secretProperties in client.GetPropertiesOfSecretsAsync(cancellationToken))
            {
                secrets.Add(new SecretInfo
                {
                    Name = secretProperties.Name,
                    Enabled = secretProperties.Enabled,
                    CreatedOn = secretProperties.CreatedOn?.DateTime,
                    UpdatedOn = secretProperties.UpdatedOn?.DateTime,
                    ExpiresOn = secretProperties.ExpiresOn?.DateTime,
                    ContentType = secretProperties.ContentType,
                    Tags = secretProperties.Tags?.ToDictionary(t => t.Key, t => t.Value)
                });
            }

            Logger.LogInformation(
                "Listed {Count} secrets in vault {VaultUri}",
                secrets.Count,
                vaultUri);

            return new ListSecretsResult
            {
                VaultUri = vaultUri,
                Secrets = secrets,
                Count = secrets.Count
            };
        }, "ListSecrets", cancellationToken);
    }
}

public record ListSecretsResult
{
    public required string VaultUri { get; init; }
    public required List<SecretInfo> Secrets { get; init; }
    public int Count { get; init; }
}

public record SecretInfo
{
    public required string Name { get; init; }
    public bool? Enabled { get; init; }
    public DateTime? CreatedOn { get; init; }
    public DateTime? UpdatedOn { get; init; }
    public DateTime? ExpiresOn { get; init; }
    public string? ContentType { get; init; }
    public Dictionary<string, string>? Tags { get; init; }
}
