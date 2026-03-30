namespace AzureConduit.Mcp.D365.Tools.SupplyChain;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Lists sales orders from D365 Supply Chain Management.
/// </summary>
public class ListSalesOrdersTool : D365BaseService
{
    public ListSalesOrdersTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<ListSalesOrdersTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<ListSalesOrdersResult> ExecuteAsync(
        string? customerAccount = null,
        string? status = null,
        int top = 100,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = BuildEndpoint(customerAccount, status, top);
            var orders = await GetODataCollectionAsync<SalesOrderDto>(endpoint, cancellationToken);

            Logger.LogInformation("Listed {Count} sales orders from D365", orders.Count);

            return new ListSalesOrdersResult
            {
                SalesOrders = orders.Select(MapSalesOrder).ToList(),
                Count = orders.Count
            };
        }, "ListSalesOrders", cancellationToken);
    }

    private static string BuildEndpoint(string? customerAccount, string? status, int top)
    {
        var endpoint = $"/SalesOrderHeadersV2?$top={top}";
        var filters = new List<string>();

        if (!string.IsNullOrWhiteSpace(customerAccount))
            filters.Add($"InvoiceCustomerAccountNumber eq '{customerAccount}'");

        if (!string.IsNullOrWhiteSpace(status))
            filters.Add($"SalesOrderStatus eq '{status}'");

        if (filters.Count > 0)
            endpoint += $"&$filter={string.Join(" and ", filters)}";

        endpoint += "&$orderby=OrderCreationDateTime desc";

        return endpoint;
    }

    private static SalesOrderInfo MapSalesOrder(SalesOrderDto dto) => new()
    {
        SalesOrderNumber = dto.SalesOrderNumber ?? "",
        CustomerAccount = dto.InvoiceCustomerAccountNumber,
        CustomerName = dto.CustomerName,
        OrderDate = dto.OrderCreationDateTime,
        RequestedShipDate = dto.RequestedShippingDate,
        TotalAmount = dto.TotalInvoiceAmount,
        Currency = dto.CurrencyCode,
        Status = dto.SalesOrderStatus
    };

    private class SalesOrderDto
    {
        public string? SalesOrderNumber { get; set; }
        public string? InvoiceCustomerAccountNumber { get; set; }
        public string? CustomerName { get; set; }
        public DateTime? OrderCreationDateTime { get; set; }
        public DateTime? RequestedShippingDate { get; set; }
        public decimal? TotalInvoiceAmount { get; set; }
        public string? CurrencyCode { get; set; }
        public string? SalesOrderStatus { get; set; }
    }
}

public record ListSalesOrdersResult
{
    public required List<SalesOrderInfo> SalesOrders { get; init; }
    public int Count { get; init; }
}

public record SalesOrderInfo
{
    public required string SalesOrderNumber { get; init; }
    public string? CustomerAccount { get; init; }
    public string? CustomerName { get; init; }
    public DateTime? OrderDate { get; init; }
    public DateTime? RequestedShipDate { get; init; }
    public decimal? TotalAmount { get; init; }
    public string? Currency { get; init; }
    public string? Status { get; init; }
}
