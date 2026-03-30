namespace AzureConduit.Mcp.Core.Auth;

using Azure.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Http;

/// <summary>
/// Provides OBO-enabled TokenCredentials for Azure SDK clients.
/// Creates credentials that exchange the current user's token for downstream API access.
/// </summary>
public class OboTokenCredentialProvider : IOboTokenCredentialProvider
{
    private readonly IUserTokenAccessor _tokenAccessor;
    private readonly OboConfiguration _config;
    private readonly OboTokenCache _cache;
    private readonly ILogger<OboTokenCredentialProvider> _logger;

    public OboTokenCredentialProvider(
        IUserTokenAccessor tokenAccessor,
        IOptions<OboConfiguration> config,
        OboTokenCache cache,
        ILogger<OboTokenCredentialProvider> logger)
    {
        _tokenAccessor = tokenAccessor ?? throw new ArgumentNullException(nameof(tokenAccessor));
        _config = config?.Value ?? throw new ArgumentNullException(nameof(config));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Validate configuration at startup
        _config.Validate();
    }

    /// <inheritdoc />
    public TokenCredential GetCredential()
    {
        var userToken = _tokenAccessor.GetRequiredUserToken();

        _logger.LogDebug(
            "Creating OBO credential for user. Token suffix: ...{Suffix}",
            GetTokenSuffix(userToken));

        return new OboCredential(_config, userToken, _cache, _logger);
    }

    /// <inheritdoc />
    public TokenCredential GetCredential(string tenantId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
            throw new ArgumentNullException(nameof(tenantId));

        var userToken = _tokenAccessor.GetRequiredUserToken();

        // Create config with overridden tenant
        var configWithTenant = new OboConfiguration
        {
            TenantId = tenantId,
            ClientId = _config.ClientId,
            ClientSecret = _config.ClientSecret,
            ClientCertificateThumbprint = _config.ClientCertificateThumbprint,
            ClientCertificatePath = _config.ClientCertificatePath,
            ClientCertificatePassword = _config.ClientCertificatePassword,
            TokenCacheMinutes = _config.TokenCacheMinutes,
            UserTokenHeader = _config.UserTokenHeader,
            CloudInstance = _config.CloudInstance,
            EnableCaching = _config.EnableCaching
        };

        _logger.LogDebug(
            "Creating OBO credential for tenant {TenantId}, user token suffix: ...{Suffix}",
            tenantId,
            GetTokenSuffix(userToken));

        return new OboCredential(configWithTenant, userToken, _cache, _logger);
    }

    /// <inheritdoc />
    public string? GetUserTokenSuffix()
    {
        var token = _tokenAccessor.GetUserToken();
        return token is not null ? GetTokenSuffix(token) : null;
    }

    private static string GetTokenSuffix(string token)
    {
        // Return last 8 characters for logging (safe, not reversible)
        return token.Length > 8 ? token[^8..] : token;
    }
}
