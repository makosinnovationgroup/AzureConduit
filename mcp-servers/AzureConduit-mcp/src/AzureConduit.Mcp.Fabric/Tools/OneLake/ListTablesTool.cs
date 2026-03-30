namespace AzureConduit.Mcp.Fabric.Tools.OneLake;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

/// <summary>
/// List tables within a lakehouse using the Tables API
/// </summary>
public class ListOneLakeTablesTool : FabricBaseService
{
    public ListOneLakeTablesTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListOneLakeTablesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ListOneLakeTablesResult> ExecuteAsync(string workspaceId, string lakehouseId, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);

            var response = await client.GetAsync($"/workspaces/{workspaceId}/lakehouses/{lakehouseId}/tables", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<ODataResponse<OneLakeTableInfo>>(content, JsonOptions);

            return new ListOneLakeTablesResult
            {
                WorkspaceId = workspaceId,
                LakehouseId = lakehouseId,
                Tables = result?.Value ?? new(),
                Count = result?.Value?.Count ?? 0
            };
        }, "ListOneLakeTables", ct);
    }
}

public record ListOneLakeTablesResult
{
    public required string WorkspaceId { get; init; }
    public required string LakehouseId { get; init; }
    public required List<OneLakeTableInfo> Tables { get; init; }
    public int Count { get; init; }
}

public record OneLakeTableInfo
{
    public required string Name { get; init; }
    public string? Type { get; init; }
    public string? Location { get; init; }
    public string? Format { get; init; }
}
