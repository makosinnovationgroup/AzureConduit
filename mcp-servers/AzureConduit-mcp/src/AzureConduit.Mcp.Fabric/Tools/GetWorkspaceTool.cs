namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class GetWorkspaceTool : FabricBaseService
{
    public GetWorkspaceTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetWorkspaceTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<WorkspaceDetails> ExecuteAsync(string workspaceId, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var response = await client.GetAsync($"/workspaces/{workspaceId}", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<WorkspaceDetails>(content, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize workspace");
        }, "GetWorkspace", ct);
    }
}

public record WorkspaceDetails
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public string? Description { get; init; }
    public string? Type { get; init; }
    public string? CapacityId { get; init; }
    public string? CapacityAssignmentProgress { get; init; }
}
