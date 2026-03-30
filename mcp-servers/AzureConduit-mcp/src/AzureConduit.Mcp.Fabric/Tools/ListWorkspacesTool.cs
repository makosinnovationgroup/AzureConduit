namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class ListWorkspacesTool : FabricBaseService
{
    public ListWorkspacesTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListWorkspacesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ListWorkspacesResult> ExecuteAsync(int top = 100, string? continuationToken = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var url = $"/workspaces?$top={top}";
            if (!string.IsNullOrEmpty(continuationToken))
                url += $"&continuationToken={Uri.EscapeDataString(continuationToken)}";

            var response = await client.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<ODataResponse<WorkspaceSummary>>(content, JsonOptions);

            return new ListWorkspacesResult
            {
                Workspaces = result?.Value ?? new(),
                ContinuationToken = result?.ContinuationToken
            };
        }, "ListWorkspaces", ct);
    }
}

public record ListWorkspacesResult
{
    public required List<WorkspaceSummary> Workspaces { get; init; }
    public string? ContinuationToken { get; init; }
}

public record WorkspaceSummary
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public string? Description { get; init; }
    public string? Type { get; init; }
    public string? CapacityId { get; init; }
}
