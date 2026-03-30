namespace AzureConduit.Mcp.Core.Auth;

using System.Security.Cryptography.X509Certificates;
using Azure.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Identity.Client;
using AzureConduit.Mcp.Core.Exceptions;

/// <summary>
/// Azure SDK-compatible TokenCredential that performs OBO token exchange.
/// Exchanges a user's access token for a downstream API token.
/// </summary>
public class OboCredential : TokenCredential
{
    private readonly IConfidentialClientApplication _msalClient;
    private readonly string _userAssertion;
    private readonly OboTokenCache _cache;
    private readonly bool _enableCaching;
    private readonly ILogger? _logger;

    /// <summary>
    /// Creates a new OBO credential.
    /// </summary>
    /// <param name="config">OBO configuration</param>
    /// <param name="userAssertion">The user's access token to exchange</param>
    /// <param name="cache">Token cache instance</param>
    /// <param name="logger">Optional logger</param>
    public OboCredential(
        OboConfiguration config,
        string userAssertion,
        OboTokenCache cache,
        ILogger? logger = null)
    {
        _userAssertion = userAssertion ?? throw new ArgumentNullException(nameof(userAssertion));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _enableCaching = config.EnableCaching;
        _logger = logger;

        _msalClient = BuildMsalClient(config);
    }

    /// <inheritdoc />
    public override AccessToken GetToken(
        TokenRequestContext requestContext,
        CancellationToken cancellationToken)
    {
        return GetTokenAsync(requestContext, cancellationToken)
            .AsTask()
            .GetAwaiter()
            .GetResult();
    }

    /// <inheritdoc />
    public override async ValueTask<AccessToken> GetTokenAsync(
        TokenRequestContext requestContext,
        CancellationToken cancellationToken)
    {
        var scopes = requestContext.Scopes;

        // Check cache first
        if (_enableCaching)
        {
            var cacheKey = OboTokenCache.GenerateCacheKey(_userAssertion, scopes);
            if (_cache.TryGet(cacheKey, out var cachedToken))
            {
                _logger?.LogDebug("OBO token cache hit for scopes: {Scopes}", string.Join(", ", scopes));
                return cachedToken;
            }
        }

        _logger?.LogDebug("Performing OBO token exchange for scopes: {Scopes}", string.Join(", ", scopes));

        try
        {
            var result = await _msalClient.AcquireTokenOnBehalfOf(
                    scopes,
                    new UserAssertion(_userAssertion))
                .ExecuteAsync(cancellationToken)
                .ConfigureAwait(false);

            if (result?.AccessToken is null)
            {
                throw OboAuthenticationException.InvalidGrant(
                    "OBO token exchange succeeded but no token was returned");
            }

            var accessToken = new AccessToken(
                result.AccessToken,
                result.ExpiresOn);

            // Cache with 5-minute buffer before expiry
            if (_enableCaching)
            {
                var cacheKey = OboTokenCache.GenerateCacheKey(_userAssertion, scopes);
                var cacheExpiry = result.ExpiresOn.AddMinutes(-5);
                if (cacheExpiry > DateTimeOffset.UtcNow)
                {
                    _cache.Set(cacheKey, accessToken, cacheExpiry);
                    _logger?.LogDebug("Cached OBO token, expires at {Expiry}", cacheExpiry);
                }
            }

            _logger?.LogInformation(
                "OBO token exchange successful for scopes: {Scopes}, expires: {Expiry}",
                string.Join(", ", scopes),
                result.ExpiresOn);

            return accessToken;
        }
        catch (MsalUiRequiredException ex)
        {
            _logger?.LogWarning(
                ex,
                "OBO token exchange requires user interaction. Error: {Error}, Claims: {Claims}",
                ex.ErrorCode,
                ex.Claims);

            throw OboAuthenticationException.InteractionRequired(
                $"User must re-authenticate: {ex.Message}",
                ex.Claims,
                ex);
        }
        catch (MsalServiceException ex) when (ex.ErrorCode == "invalid_grant")
        {
            _logger?.LogWarning(
                ex,
                "OBO token exchange failed: invalid_grant. User token may be expired.");

            throw OboAuthenticationException.InvalidGrant(
                "User token is invalid or expired. Please re-authenticate.",
                ex);
        }
        catch (MsalServiceException ex)
        {
            _logger?.LogError(
                ex,
                "OBO token exchange failed. Error: {Error}, Status: {Status}",
                ex.ErrorCode,
                ex.StatusCode);

            throw new OboAuthenticationException(
                $"OBO token exchange failed: {ex.Message}",
                ex);
        }
        catch (MsalClientException ex)
        {
            _logger?.LogError(ex, "MSAL client error during OBO exchange: {Error}", ex.ErrorCode);

            throw OboAuthenticationException.ConfigurationError(
                $"OBO configuration error: {ex.Message}",
                ex);
        }
    }

    private static IConfidentialClientApplication BuildMsalClient(OboConfiguration config)
    {
        config.Validate();

        var authority = GetAuthority(config);

        var builder = ConfidentialClientApplicationBuilder
            .Create(config.ClientId)
            .WithAuthority(authority);

        // Configure credentials (certificate preferred over secret)
        if (!string.IsNullOrWhiteSpace(config.ClientCertificateThumbprint))
        {
            var cert = LoadCertificateFromStore(config.ClientCertificateThumbprint);
            builder = builder.WithCertificate(cert);
        }
        else if (!string.IsNullOrWhiteSpace(config.ClientCertificatePath))
        {
            var cert = LoadCertificateFromFile(
                config.ClientCertificatePath,
                config.ClientCertificatePassword);
            builder = builder.WithCertificate(cert);
        }
        else if (!string.IsNullOrWhiteSpace(config.ClientSecret))
        {
            builder = builder.WithClientSecret(config.ClientSecret);
        }

        return builder.Build();
    }

    private static string GetAuthority(OboConfiguration config)
    {
        var instance = config.CloudInstance?.ToLowerInvariant() switch
        {
            "azurechina" => "https://login.chinacloudapi.cn",
            "azuregovernment" => "https://login.microsoftonline.us",
            "azuregermany" => "https://login.microsoftonline.de",
            _ => "https://login.microsoftonline.com"
        };

        return $"{instance}/{config.TenantId}";
    }

    private static X509Certificate2 LoadCertificateFromStore(string thumbprint)
    {
        // Try CurrentUser first, then LocalMachine
        var certificate = FindCertificate(StoreLocation.CurrentUser, thumbprint)
            ?? FindCertificate(StoreLocation.LocalMachine, thumbprint);

        if (certificate is null)
        {
            throw new InvalidOperationException(
                $"Certificate with thumbprint '{thumbprint}' not found in certificate store. " +
                "Ensure the certificate is installed in CurrentUser or LocalMachine store.");
        }

        return certificate;
    }

    private static X509Certificate2? FindCertificate(StoreLocation location, string thumbprint)
    {
        using var store = new X509Store(StoreName.My, location);
        store.Open(OpenFlags.ReadOnly);

        var certs = store.Certificates.Find(
            X509FindType.FindByThumbprint,
            thumbprint,
            validOnly: false);

        return certs.Count > 0 ? certs[0] : null;
    }

    private static X509Certificate2 LoadCertificateFromFile(string path, string? password)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException(
                $"Certificate file not found: {path}",
                path);
        }

        return new X509Certificate2(
            path,
            password,
            X509KeyStorageFlags.MachineKeySet | X509KeyStorageFlags.PersistKeySet);
    }
}
