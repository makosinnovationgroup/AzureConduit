namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class ListLakehouseTablesTool : FabricBaseService
{
    public ListLakehouseTablesTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListLakehouseTablesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ListLakehouseTablesResult> ExecuteAsync(string workspaceId, string lakehouseId, string? continuationToken = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var url = $"/workspaces/{workspaceId}/lakehouses/{lakehouseId}/tables";
            if (!string.IsNullOrEmpty(continuationToken))
                url += $"?continuationToken={Uri.EscapeDataString(continuationToken)}";

            var response = await client.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<ODataResponse<LakehouseTable>>(content, JsonOptions);

            return new ListLakehouseTablesResult
            {
                Tables = result?.Value ?? new(),
                ContinuationToken = result?.ContinuationToken
            };
        }, "ListLakehouseTables", ct);
    }
}

public record ListLakehouseTablesResult
{
    public required List<LakehouseTable> Tables { get; init; }
    public string? ContinuationToken { get; init; }
}

public record LakehouseTable
{
    public required string Name { get; init; }
    public string? Type { get; init; }
    public string? Location { get; init; }
    public string? Format { get; init; }
}
