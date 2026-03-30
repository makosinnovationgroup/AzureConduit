namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class ListWarehousesTool : FabricBaseService
{
    public ListWarehousesTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListWarehousesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ListWarehousesResult> ExecuteAsync(string workspaceId, string? continuationToken = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var url = $"/workspaces/{workspaceId}/warehouses";
            if (!string.IsNullOrEmpty(continuationToken))
                url += $"?continuationToken={Uri.EscapeDataString(continuationToken)}";

            var response = await client.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<ODataResponse<WarehouseSummary>>(content, JsonOptions);

            return new ListWarehousesResult
            {
                Warehouses = result?.Value ?? new(),
                ContinuationToken = result?.ContinuationToken
            };
        }, "ListWarehouses", ct);
    }
}

public record ListWarehousesResult
{
    public required List<WarehouseSummary> Warehouses { get; init; }
    public string? ContinuationToken { get; init; }
}

public record WarehouseSummary
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public string? Description { get; init; }
    public string? WorkspaceId { get; init; }
}
