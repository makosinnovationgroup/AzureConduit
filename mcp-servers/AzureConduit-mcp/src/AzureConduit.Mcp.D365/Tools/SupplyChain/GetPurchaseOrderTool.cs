namespace AzureConduit.Mcp.D365.Tools.SupplyChain;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Gets a specific purchase order with line details from D365 SCM.
/// </summary>
public class GetPurchaseOrderTool : D365BaseService
{
    public GetPurchaseOrderTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<GetPurchaseOrderTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<PurchaseOrderDetails> ExecuteAsync(
        string purchaseOrderNumber,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(purchaseOrderNumber))
            throw new ArgumentException("Purchase order number is required", nameof(purchaseOrderNumber));

        return await ExecuteAsync(async () =>
        {
            // Get PO header
            var headerEndpoint = $"/PurchaseOrderHeadersV2?$filter=PurchaseOrderNumber eq '{purchaseOrderNumber}'&$top=1";
            var headers = await GetODataCollectionAsync<PurchaseOrderHeaderDto>(headerEndpoint, cancellationToken);
            var header = headers.FirstOrDefault()
                ?? throw new KeyNotFoundException($"Purchase order {purchaseOrderNumber} not found");

            // Get PO lines
            var linesEndpoint = $"/PurchaseOrderLinesV2?$filter=PurchaseOrderNumber eq '{purchaseOrderNumber}'";
            var lines = await GetODataCollectionAsync<PurchaseOrderLineDto>(linesEndpoint, cancellationToken);

            Logger.LogInformation(
                "Retrieved purchase order {PONumber} with {LineCount} lines",
                purchaseOrderNumber,
                lines.Count);

            return new PurchaseOrderDetails
            {
                PurchaseOrderNumber = header.PurchaseOrderNumber ?? purchaseOrderNumber,
                VendorAccount = header.OrderVendorAccountNumber,
                VendorName = header.VendorName,
                OrderDate = header.OrderCreationDateTime,
                RequestedDeliveryDate = header.RequestedDeliveryDate,
                Currency = header.CurrencyCode,
                Status = header.PurchaseOrderStatus,
                Lines = lines.Select((l, i) => new PurchaseOrderLineInfo
                {
                    LineNumber = l.LineNumber ?? i + 1,
                    ItemNumber = l.ItemNumber,
                    ProductName = l.ProductName,
                    OrderedQuantity = l.OrderedPurchaseQuantity,
                    ReceivedQuantity = l.ReceivedPurchaseQuantity,
                    UnitPrice = l.PurchasePrice,
                    LineAmount = l.LineAmount,
                    DeliveryDate = l.ConfirmedDeliveryDate
                }).ToList()
            };
        }, "GetPurchaseOrder", cancellationToken);
    }

    private class PurchaseOrderHeaderDto
    {
        public string? PurchaseOrderNumber { get; set; }
        public string? OrderVendorAccountNumber { get; set; }
        public string? VendorName { get; set; }
        public DateTime? OrderCreationDateTime { get; set; }
        public DateTime? RequestedDeliveryDate { get; set; }
        public string? CurrencyCode { get; set; }
        public string? PurchaseOrderStatus { get; set; }
    }

    private class PurchaseOrderLineDto
    {
        public int? LineNumber { get; set; }
        public string? ItemNumber { get; set; }
        public string? ProductName { get; set; }
        public decimal? OrderedPurchaseQuantity { get; set; }
        public decimal? ReceivedPurchaseQuantity { get; set; }
        public decimal? PurchasePrice { get; set; }
        public decimal? LineAmount { get; set; }
        public DateTime? ConfirmedDeliveryDate { get; set; }
    }
}

public record PurchaseOrderDetails
{
    public required string PurchaseOrderNumber { get; init; }
    public string? VendorAccount { get; init; }
    public string? VendorName { get; init; }
    public DateTime? OrderDate { get; init; }
    public DateTime? RequestedDeliveryDate { get; init; }
    public string? Currency { get; init; }
    public string? Status { get; init; }
    public List<PurchaseOrderLineInfo>? Lines { get; init; }
}

public record PurchaseOrderLineInfo
{
    public int LineNumber { get; init; }
    public string? ItemNumber { get; init; }
    public string? ProductName { get; init; }
    public decimal? OrderedQuantity { get; init; }
    public decimal? ReceivedQuantity { get; init; }
    public decimal? UnitPrice { get; init; }
    public decimal? LineAmount { get; init; }
    public DateTime? DeliveryDate { get; init; }
}
