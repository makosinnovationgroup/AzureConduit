namespace AzureConduit.Mcp.Azure.Tools.KeyVault;

using Azure.Security.KeyVault.Secrets;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Gets a specific secret from Key Vault.
/// Returns the secret value - ensure user has appropriate permissions.
/// </summary>
public class GetSecretTool : OboEnabledBaseService
{
    public GetSecretTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<GetSecretTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<GetSecretResult> ExecuteAsync(
        string vaultUri,
        string secretName,
        string? version = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(vaultUri))
            throw new ArgumentException("Vault URI is required", nameof(vaultUri));
        if (string.IsNullOrWhiteSpace(secretName))
            throw new ArgumentException("Secret name is required", nameof(secretName));

        return await ExecuteAsync(async () =>
        {
            var credential = GetUserCredential();
            var client = new SecretClient(new Uri(vaultUri), credential);

            KeyVaultSecret secret;
            if (!string.IsNullOrWhiteSpace(version))
            {
                secret = await client.GetSecretAsync(secretName, version, cancellationToken);
            }
            else
            {
                secret = await client.GetSecretAsync(secretName, cancellationToken: cancellationToken);
            }

            Logger.LogInformation(
                "Retrieved secret {SecretName} from vault {VaultUri}",
                secretName,
                vaultUri);

            return new GetSecretResult
            {
                Name = secret.Name,
                Value = secret.Value,
                Version = secret.Properties.Version,
                Enabled = secret.Properties.Enabled,
                CreatedOn = secret.Properties.CreatedOn?.DateTime,
                UpdatedOn = secret.Properties.UpdatedOn?.DateTime,
                ExpiresOn = secret.Properties.ExpiresOn?.DateTime,
                ContentType = secret.Properties.ContentType
            };
        }, "GetSecret", cancellationToken);
    }
}

public record GetSecretResult
{
    public required string Name { get; init; }
    public required string Value { get; init; }
    public string? Version { get; init; }
    public bool? Enabled { get; init; }
    public DateTime? CreatedOn { get; init; }
    public DateTime? UpdatedOn { get; init; }
    public DateTime? ExpiresOn { get; init; }
    public string? ContentType { get; init; }
}
