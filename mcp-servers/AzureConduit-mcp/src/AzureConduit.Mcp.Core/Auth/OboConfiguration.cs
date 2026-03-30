namespace AzureConduit.Mcp.Core.Auth;

/// <summary>
/// Configuration for On-Behalf-Of (OBO) authentication.
/// Bind from appsettings.json section "Obo" or environment variables.
/// </summary>
public class OboConfiguration
{
    /// <summary>
    /// Configuration section name in appsettings.json
    /// </summary>
    public const string SectionName = "Obo";

    /// <summary>
    /// Azure AD tenant ID (GUID or domain name)
    /// Environment: OBO__TENANTID
    /// </summary>
    public required string TenantId { get; set; }

    /// <summary>
    /// Client ID of the MCP server's Entra app registration
    /// Environment: OBO__CLIENTID
    /// </summary>
    public required string ClientId { get; set; }

    /// <summary>
    /// Client secret for OBO token exchange.
    /// Should be stored in Key Vault in production.
    /// Environment: OBO__CLIENTSECRET
    /// </summary>
    public string? ClientSecret { get; set; }

    /// <summary>
    /// Client certificate thumbprint (alternative to secret).
    /// Preferred for production deployments.
    /// Environment: OBO__CLIENTCERTIFICATETHUMBPRINT
    /// </summary>
    public string? ClientCertificateThumbprint { get; set; }

    /// <summary>
    /// Path to client certificate file (PFX).
    /// Alternative to thumbprint when cert is file-based.
    /// Environment: OBO__CLIENTCERTIFICATEPATH
    /// </summary>
    public string? ClientCertificatePath { get; set; }

    /// <summary>
    /// Password for client certificate file.
    /// Environment: OBO__CLIENTCERTIFICATEPASSWORD
    /// </summary>
    public string? ClientCertificatePassword { get; set; }

    /// <summary>
    /// Token cache duration in minutes. Tokens are cached per-user per-scope.
    /// Default: 5 minutes (with 5-minute buffer before expiry)
    /// Environment: OBO__TOKENCACHEMINUTES
    /// </summary>
    public int TokenCacheMinutes { get; set; } = 5;

    /// <summary>
    /// HTTP header name where APIM forwards the user's bearer token.
    /// Default: X-User-Token
    /// Environment: OBO__USERTOKENHEADER
    /// </summary>
    public string UserTokenHeader { get; set; } = "X-User-Token";

    /// <summary>
    /// Azure cloud instance. Default is AzurePublic.
    /// Options: AzurePublic, AzureChina, AzureGovernment, AzureGermany
    /// Environment: OBO__CLOUDINSTANCE
    /// </summary>
    public string CloudInstance { get; set; } = "AzurePublic";

    /// <summary>
    /// Whether to enable token caching. Disable for debugging.
    /// Default: true
    /// Environment: OBO__ENABLECACHING
    /// </summary>
    public bool EnableCaching { get; set; } = true;

    /// <summary>
    /// Validates the configuration and throws if invalid.
    /// </summary>
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(TenantId))
            throw new InvalidOperationException("OBO configuration: TenantId is required");

        if (string.IsNullOrWhiteSpace(ClientId))
            throw new InvalidOperationException("OBO configuration: ClientId is required");

        var hasSecret = !string.IsNullOrWhiteSpace(ClientSecret);
        var hasCertThumbprint = !string.IsNullOrWhiteSpace(ClientCertificateThumbprint);
        var hasCertPath = !string.IsNullOrWhiteSpace(ClientCertificatePath);

        if (!hasSecret && !hasCertThumbprint && !hasCertPath)
        {
            throw new InvalidOperationException(
                "OBO configuration: Either ClientSecret, ClientCertificateThumbprint, " +
                "or ClientCertificatePath must be provided");
        }
    }
}
