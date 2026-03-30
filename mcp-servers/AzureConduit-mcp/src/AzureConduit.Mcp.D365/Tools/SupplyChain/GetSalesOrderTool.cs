namespace AzureConduit.Mcp.D365.Tools.SupplyChain;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Gets a specific sales order with line details from D365 SCM.
/// </summary>
public class GetSalesOrderTool : D365BaseService
{
    public GetSalesOrderTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<GetSalesOrderTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<SalesOrderDetails> ExecuteAsync(
        string salesOrderNumber,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(salesOrderNumber))
            throw new ArgumentException("Sales order number is required", nameof(salesOrderNumber));

        return await ExecuteAsync(async () =>
        {
            // Get SO header
            var headerEndpoint = $"/SalesOrderHeadersV2?$filter=SalesOrderNumber eq '{salesOrderNumber}'&$top=1";
            var headers = await GetODataCollectionAsync<SalesOrderHeaderDto>(headerEndpoint, cancellationToken);
            var header = headers.FirstOrDefault()
                ?? throw new KeyNotFoundException($"Sales order {salesOrderNumber} not found");

            // Get SO lines
            var linesEndpoint = $"/SalesOrderLines?$filter=SalesOrderNumber eq '{salesOrderNumber}'";
            var lines = await GetODataCollectionAsync<SalesOrderLineDto>(linesEndpoint, cancellationToken);

            Logger.LogInformation(
                "Retrieved sales order {SONumber} with {LineCount} lines",
                salesOrderNumber,
                lines.Count);

            return new SalesOrderDetails
            {
                SalesOrderNumber = header.SalesOrderNumber ?? salesOrderNumber,
                CustomerAccount = header.InvoiceCustomerAccountNumber,
                CustomerName = header.CustomerName,
                OrderDate = header.OrderCreationDateTime,
                RequestedShipDate = header.RequestedShippingDate,
                Currency = header.CurrencyCode,
                Status = header.SalesOrderStatus,
                Lines = lines.Select((l, i) => new SalesOrderLineInfo
                {
                    LineNumber = l.LineNumber ?? i + 1,
                    ItemNumber = l.ItemNumber,
                    ProductName = l.ProductName,
                    OrderedQuantity = l.OrderedSalesQuantity,
                    ShippedQuantity = l.DeliveredSalesQuantity,
                    UnitPrice = l.SalesPrice,
                    LineAmount = l.LineAmount,
                    ShipDate = l.ConfirmedShippingDate
                }).ToList()
            };
        }, "GetSalesOrder", cancellationToken);
    }

    private class SalesOrderHeaderDto
    {
        public string? SalesOrderNumber { get; set; }
        public string? InvoiceCustomerAccountNumber { get; set; }
        public string? CustomerName { get; set; }
        public DateTime? OrderCreationDateTime { get; set; }
        public DateTime? RequestedShippingDate { get; set; }
        public string? CurrencyCode { get; set; }
        public string? SalesOrderStatus { get; set; }
    }

    private class SalesOrderLineDto
    {
        public int? LineNumber { get; set; }
        public string? ItemNumber { get; set; }
        public string? ProductName { get; set; }
        public decimal? OrderedSalesQuantity { get; set; }
        public decimal? DeliveredSalesQuantity { get; set; }
        public decimal? SalesPrice { get; set; }
        public decimal? LineAmount { get; set; }
        public DateTime? ConfirmedShippingDate { get; set; }
    }
}

public record SalesOrderDetails
{
    public required string SalesOrderNumber { get; init; }
    public string? CustomerAccount { get; init; }
    public string? CustomerName { get; init; }
    public DateTime? OrderDate { get; init; }
    public DateTime? RequestedShipDate { get; init; }
    public string? Currency { get; init; }
    public string? Status { get; init; }
    public List<SalesOrderLineInfo>? Lines { get; init; }
}

public record SalesOrderLineInfo
{
    public int LineNumber { get; init; }
    public string? ItemNumber { get; init; }
    public string? ProductName { get; init; }
    public decimal? OrderedQuantity { get; init; }
    public decimal? ShippedQuantity { get; init; }
    public decimal? UnitPrice { get; init; }
    public decimal? LineAmount { get; init; }
    public DateTime? ShipDate { get; init; }
}
