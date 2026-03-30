namespace AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Configuration for Dynamics 365 Finance & Operations API access.
/// </summary>
public class D365Configuration
{
    public const string SectionName = "D365";

    /// <summary>
    /// D365 F&O environment URL (e.g., https://contoso.operations.dynamics.com)
    /// </summary>
    public required string EnvironmentUrl { get; set; }

    /// <summary>
    /// OData API version (default: v9.2)
    /// </summary>
    public string ApiVersion { get; set; } = "v9.2";

    /// <summary>
    /// Gets the base API URL for OData endpoints.
    /// </summary>
    public string GetODataBaseUrl()
    {
        var baseUrl = EnvironmentUrl.TrimEnd('/');
        return $"{baseUrl}/data";
    }

    /// <summary>
    /// Gets the scope for D365 F&O API access.
    /// </summary>
    public string GetScope()
    {
        var baseUrl = EnvironmentUrl.TrimEnd('/');
        return $"{baseUrl}/.default";
    }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(EnvironmentUrl))
            throw new InvalidOperationException("D365 configuration: EnvironmentUrl is required");

        if (!Uri.TryCreate(EnvironmentUrl, UriKind.Absolute, out _))
            throw new InvalidOperationException("D365 configuration: EnvironmentUrl must be a valid URL");
    }
}
