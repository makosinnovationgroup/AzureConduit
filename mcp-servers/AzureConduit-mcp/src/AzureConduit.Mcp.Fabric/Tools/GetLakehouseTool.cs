namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class GetLakehouseTool : FabricBaseService
{
    public GetLakehouseTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetLakehouseTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<LakehouseDetails> ExecuteAsync(string workspaceId, string lakehouseId, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var response = await client.GetAsync($"/workspaces/{workspaceId}/lakehouses/{lakehouseId}", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<LakehouseDetails>(content, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize lakehouse");
        }, "GetLakehouse", ct);
    }
}

public record LakehouseDetails
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public string? Description { get; init; }
    public string? WorkspaceId { get; init; }
    public LakehouseProperties? Properties { get; init; }
}

public record LakehouseProperties
{
    public string? OneLakeTablesPath { get; init; }
    public string? OneLakeFilesPath { get; init; }
    public string? SqlEndpointProperties { get; init; }
}
