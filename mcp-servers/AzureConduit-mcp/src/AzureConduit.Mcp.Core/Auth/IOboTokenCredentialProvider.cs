namespace AzureConduit.Mcp.Core.Auth;

using Azure.Core;

/// <summary>
/// Provides OBO-enabled TokenCredentials for Azure SDK clients.
/// This replaces Microsoft's default credential provider to enable
/// user-scoped API access.
/// </summary>
public interface IOboTokenCredentialProvider
{
    /// <summary>
    /// Gets a TokenCredential that will use OBO to exchange the current
    /// user's token for downstream API access.
    /// </summary>
    /// <returns>A TokenCredential configured for OBO exchange</returns>
    /// <exception cref="UnauthorizedAccessException">Thrown when no user token is available</exception>
    TokenCredential GetCredential();

    /// <summary>
    /// Gets a TokenCredential for a specific tenant (multi-tenant scenarios).
    /// </summary>
    /// <param name="tenantId">The target tenant ID</param>
    /// <returns>A TokenCredential configured for OBO exchange in the specified tenant</returns>
    TokenCredential GetCredential(string tenantId);

    /// <summary>
    /// Gets the user's token for inspection or logging (last 8 chars only).
    /// Never log the full token.
    /// </summary>
    string? GetUserTokenSuffix();
}
