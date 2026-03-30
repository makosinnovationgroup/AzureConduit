namespace AzureConduit.Mcp.Core.Http;

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;

/// <summary>
/// Extracts the user's bearer token and identity claims from the HTTP request.
/// Works with tokens forwarded by APIM in the X-User-Token header.
/// </summary>
public class UserTokenAccessor : IUserTokenAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly OboConfiguration _config;
    private readonly ILogger<UserTokenAccessor> _logger;

    // Header names set by APIM policy
    private const string UserIdHeader = "X-User-Id";
    private const string UserNameHeader = "X-User-Name";

    public UserTokenAccessor(
        IHttpContextAccessor httpContextAccessor,
        IOptions<OboConfiguration> config,
        ILogger<UserTokenAccessor> logger)
    {
        _httpContextAccessor = httpContextAccessor;
        _config = config.Value;
        _logger = logger;
    }

    /// <inheritdoc />
    public string? GetUserToken()
    {
        var context = _httpContextAccessor.HttpContext;
        if (context is null)
        {
            _logger.LogDebug("No HTTP context available");
            return null;
        }

        // Try configured header first (set by APIM: X-User-Token)
        if (context.Request.Headers.TryGetValue(_config.UserTokenHeader, out var headerToken)
            && !string.IsNullOrWhiteSpace(headerToken))
        {
            _logger.LogDebug("Found user token in {Header} header", _config.UserTokenHeader);
            return ExtractBearerToken(headerToken.ToString());
        }

        // Fallback to Authorization header (for local development/testing)
        if (context.Request.Headers.TryGetValue("Authorization", out var authHeader)
            && !string.IsNullOrWhiteSpace(authHeader))
        {
            _logger.LogDebug("Found user token in Authorization header (fallback)");
            return ExtractBearerToken(authHeader.ToString());
        }

        _logger.LogDebug("No user token found in request headers");
        return null;
    }

    /// <inheritdoc />
    public string GetRequiredUserToken()
    {
        var token = GetUserToken();
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning("Required user token not found in request");
            throw new UnauthorizedAccessException(
                $"User token not found. Ensure APIM is configured to forward the token " +
                $"in the '{_config.UserTokenHeader}' header.");
        }
        return token;
    }

    /// <inheritdoc />
    public string? GetUserId()
    {
        var context = _httpContextAccessor.HttpContext;
        if (context is null) return null;

        // Get from header set by APIM policy
        if (context.Request.Headers.TryGetValue(UserIdHeader, out var userId)
            && !string.IsNullOrWhiteSpace(userId))
        {
            return userId.ToString();
        }

        return null;
    }

    /// <inheritdoc />
    public string? GetUserPrincipalName()
    {
        var context = _httpContextAccessor.HttpContext;
        if (context is null) return null;

        // Get from header set by APIM policy
        if (context.Request.Headers.TryGetValue(UserNameHeader, out var userName)
            && !string.IsNullOrWhiteSpace(userName))
        {
            return userName.ToString();
        }

        return null;
    }

    /// <summary>
    /// Extracts the token value from a Bearer token header.
    /// </summary>
    private static string? ExtractBearerToken(string headerValue)
    {
        if (string.IsNullOrWhiteSpace(headerValue))
            return null;

        // Handle "Bearer {token}" format
        if (headerValue.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return headerValue["Bearer ".Length..].Trim();
        }

        // Return as-is if no Bearer prefix
        return headerValue.Trim();
    }
}
