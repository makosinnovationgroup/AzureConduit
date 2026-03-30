namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class GetWarehouseTool : FabricBaseService
{
    public GetWarehouseTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetWarehouseTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<WarehouseDetails> ExecuteAsync(string workspaceId, string warehouseId, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var response = await client.GetAsync($"/workspaces/{workspaceId}/warehouses/{warehouseId}", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<WarehouseDetails>(content, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize warehouse");
        }, "GetWarehouse", ct);
    }
}

public record WarehouseDetails
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public string? Description { get; init; }
    public string? WorkspaceId { get; init; }
    public WarehouseProperties? Properties { get; init; }
}

public record WarehouseProperties
{
    public string? ConnectionString { get; init; }
    public string? SqlEndpointProperties { get; init; }
}
