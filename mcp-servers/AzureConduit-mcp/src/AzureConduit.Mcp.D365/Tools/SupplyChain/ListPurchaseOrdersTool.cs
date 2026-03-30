namespace AzureConduit.Mcp.D365.Tools.SupplyChain;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Lists purchase orders from D365 Supply Chain Management.
/// </summary>
public class ListPurchaseOrdersTool : D365BaseService
{
    public ListPurchaseOrdersTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<ListPurchaseOrdersTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<ListPurchaseOrdersResult> ExecuteAsync(
        string? vendorAccount = null,
        string? status = null,
        int top = 100,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = BuildEndpoint(vendorAccount, status, top);
            var orders = await GetODataCollectionAsync<PurchaseOrderDto>(endpoint, cancellationToken);

            Logger.LogInformation("Listed {Count} purchase orders from D365", orders.Count);

            return new ListPurchaseOrdersResult
            {
                PurchaseOrders = orders.Select(MapPurchaseOrder).ToList(),
                Count = orders.Count
            };
        }, "ListPurchaseOrders", cancellationToken);
    }

    private static string BuildEndpoint(string? vendorAccount, string? status, int top)
    {
        var endpoint = $"/PurchaseOrderHeadersV2?$top={top}";
        var filters = new List<string>();

        if (!string.IsNullOrWhiteSpace(vendorAccount))
            filters.Add($"OrderVendorAccountNumber eq '{vendorAccount}'");

        if (!string.IsNullOrWhiteSpace(status))
            filters.Add($"PurchaseOrderStatus eq '{status}'");

        if (filters.Count > 0)
            endpoint += $"&$filter={string.Join(" and ", filters)}";

        endpoint += "&$orderby=OrderCreationDateTime desc";

        return endpoint;
    }

    private static PurchaseOrderInfo MapPurchaseOrder(PurchaseOrderDto dto) => new()
    {
        PurchaseOrderNumber = dto.PurchaseOrderNumber ?? "",
        VendorAccount = dto.OrderVendorAccountNumber,
        VendorName = dto.VendorName,
        OrderDate = dto.OrderCreationDateTime,
        RequestedDeliveryDate = dto.RequestedDeliveryDate,
        TotalAmount = dto.TotalDiscountAmount,
        Currency = dto.CurrencyCode,
        Status = dto.PurchaseOrderStatus,
        BuyerGroup = dto.BuyerGroupId
    };

    private class PurchaseOrderDto
    {
        public string? PurchaseOrderNumber { get; set; }
        public string? OrderVendorAccountNumber { get; set; }
        public string? VendorName { get; set; }
        public DateTime? OrderCreationDateTime { get; set; }
        public DateTime? RequestedDeliveryDate { get; set; }
        public decimal? TotalDiscountAmount { get; set; }
        public string? CurrencyCode { get; set; }
        public string? PurchaseOrderStatus { get; set; }
        public string? BuyerGroupId { get; set; }
    }
}

public record ListPurchaseOrdersResult
{
    public required List<PurchaseOrderInfo> PurchaseOrders { get; init; }
    public int Count { get; init; }
}

public record PurchaseOrderInfo
{
    public required string PurchaseOrderNumber { get; init; }
    public string? VendorAccount { get; init; }
    public string? VendorName { get; init; }
    public DateTime? OrderDate { get; init; }
    public DateTime? RequestedDeliveryDate { get; init; }
    public decimal? TotalAmount { get; init; }
    public string? Currency { get; init; }
    public string? Status { get; init; }
    public string? BuyerGroup { get; init; }
}
