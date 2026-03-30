namespace AzureConduit.Mcp.D365.Tools.SupplyChain;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Gets inventory on-hand information from D365 SCM.
/// </summary>
public class GetInventoryOnHandTool : D365BaseService
{
    public GetInventoryOnHandTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<GetInventoryOnHandTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<InventoryOnHandResult> ExecuteAsync(
        string? itemNumber = null,
        string? warehouse = null,
        int top = 100,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = BuildEndpoint(itemNumber, warehouse, top);
            var inventory = await GetODataCollectionAsync<InventoryOnHandDto>(endpoint, cancellationToken);

            Logger.LogInformation("Listed {Count} inventory on-hand records from D365", inventory.Count);

            return new InventoryOnHandResult
            {
                Inventory = inventory.Select(MapInventory).ToList(),
                Count = inventory.Count
            };
        }, "GetInventoryOnHand", cancellationToken);
    }

    private static string BuildEndpoint(string? itemNumber, string? warehouse, int top)
    {
        var endpoint = $"/InventOnHandEntities?$top={top}";
        var filters = new List<string>();

        if (!string.IsNullOrWhiteSpace(itemNumber))
            filters.Add($"ItemNumber eq '{itemNumber}'");

        if (!string.IsNullOrWhiteSpace(warehouse))
            filters.Add($"WarehouseId eq '{warehouse}'");

        // Only show items with actual inventory
        filters.Add("AvailableOnHandQuantity ne 0");

        if (filters.Count > 0)
            endpoint += $"&$filter={string.Join(" and ", filters)}";

        return endpoint;
    }

    private static InventoryOnHandInfo MapInventory(InventoryOnHandDto dto) => new()
    {
        ItemNumber = dto.ItemNumber ?? "",
        ItemName = dto.ItemName,
        Warehouse = dto.WarehouseId,
        Site = dto.SiteId,
        AvailableQuantity = dto.AvailableOnHandQuantity,
        PhysicalQuantity = dto.PhysicalInventoryQuantity,
        ReservedQuantity = dto.ReservedOnHandQuantity,
        UnitOfMeasure = dto.UnitOfMeasure
    };

    private class InventoryOnHandDto
    {
        public string? ItemNumber { get; set; }
        public string? ItemName { get; set; }
        public string? WarehouseId { get; set; }
        public string? SiteId { get; set; }
        public decimal? AvailableOnHandQuantity { get; set; }
        public decimal? PhysicalInventoryQuantity { get; set; }
        public decimal? ReservedOnHandQuantity { get; set; }
        public string? UnitOfMeasure { get; set; }
    }
}

public record InventoryOnHandResult
{
    public required List<InventoryOnHandInfo> Inventory { get; init; }
    public int Count { get; init; }
}

public record InventoryOnHandInfo
{
    public required string ItemNumber { get; init; }
    public string? ItemName { get; init; }
    public string? Warehouse { get; init; }
    public string? Site { get; init; }
    public decimal? AvailableQuantity { get; init; }
    public decimal? PhysicalQuantity { get; init; }
    public decimal? ReservedQuantity { get; init; }
    public string? UnitOfMeasure { get; init; }
}
