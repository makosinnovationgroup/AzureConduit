namespace AzureConduit.Mcp.Fabric.Configuration;

public class FabricConfiguration
{
    public const string SectionName = "Fabric";

    /// <summary>
    /// Fabric API base URL (default: https://api.fabric.microsoft.com/v1)
    /// </summary>
    public string BaseUrl { get; set; } = "https://api.fabric.microsoft.com/v1";

    /// <summary>
    /// Default scope for Fabric API access
    /// </summary>
    public string Scope { get; set; } = "https://api.fabric.microsoft.com/.default";

    /// <summary>
    /// Optional capacity ID for creating workspaces
    /// </summary>
    public string? DefaultCapacityId { get; set; }

    public string GetScope() => Scope;
}
