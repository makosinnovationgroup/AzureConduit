namespace AzureConduit.Mcp.Fabric.Tools.Docs;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

/// <summary>
/// Get core Fabric platform API specifications
/// </summary>
public class GetPlatformApiSpecTool : FabricBaseService
{
    public GetPlatformApiSpecTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetPlatformApiSpecTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public Task<PlatformApiSpecResult> ExecuteAsync(CancellationToken ct = default)
    {
        var spec = new PlatformApiSpec
        {
            BaseUrl = "https://api.fabric.microsoft.com/v1",
            Authentication = "OAuth 2.0 Bearer Token",
            Scope = "https://api.fabric.microsoft.com/.default",
            CoreApis = new List<CoreApiSpec>
            {
                new() { Name = "Workspaces", BasePath = "/workspaces", Description = "Manage Fabric workspaces" },
                new() { Name = "Items", BasePath = "/workspaces/{workspaceId}/items", Description = "List and manage workspace items" },
                new() { Name = "Capacities", BasePath = "/capacities", Description = "Manage Fabric capacities" },
                new() { Name = "Admin", BasePath = "/admin", Description = "Admin operations (tenant settings, users)" },
                new() { Name = "OneLake", BasePath = "https://onelake.dfs.fabric.microsoft.com", Description = "OneLake file storage (ADLS Gen2 compatible)" }
            },
            CommonHeaders = new Dictionary<string, string>
            {
                ["Authorization"] = "Bearer {access_token}",
                ["Content-Type"] = "application/json"
            }
        };

        return Task.FromResult(new PlatformApiSpecResult { Spec = spec });
    }
}

public record PlatformApiSpecResult
{
    public required PlatformApiSpec Spec { get; init; }
}

public record PlatformApiSpec
{
    public required string BaseUrl { get; init; }
    public required string Authentication { get; init; }
    public required string Scope { get; init; }
    public required List<CoreApiSpec> CoreApis { get; init; }
    public required Dictionary<string, string> CommonHeaders { get; init; }
}

public record CoreApiSpec
{
    public required string Name { get; init; }
    public required string BasePath { get; init; }
    public required string Description { get; init; }
}
