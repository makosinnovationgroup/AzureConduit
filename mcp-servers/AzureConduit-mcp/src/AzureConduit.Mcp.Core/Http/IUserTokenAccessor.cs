namespace AzureConduit.Mcp.Core.Http;

/// <summary>
/// Provides access to the current user's bearer token from the HTTP request.
/// The token is forwarded by APIM after JWT validation.
/// </summary>
public interface IUserTokenAccessor
{
    /// <summary>
    /// Gets the user's bearer token from the current HTTP request.
    /// Returns null if no token is present.
    /// </summary>
    string? GetUserToken();

    /// <summary>
    /// Gets the user's bearer token, throwing if not present.
    /// </summary>
    /// <exception cref="UnauthorizedAccessException">Thrown when no token is found</exception>
    string GetRequiredUserToken();

    /// <summary>
    /// Gets the user's object ID (oid claim) if available.
    /// </summary>
    string? GetUserId();

    /// <summary>
    /// Gets the user's principal name (upn claim) if available.
    /// </summary>
    string? GetUserPrincipalName();
}
