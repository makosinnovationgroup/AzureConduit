namespace AzureConduit.Mcp.D365.Tools.Finance;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Gets a specific vendor invoice with line details from D365 Finance.
/// </summary>
public class GetInvoiceTool : D365BaseService
{
    public GetInvoiceTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<GetInvoiceTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<InvoiceDetails> ExecuteAsync(
        string invoiceId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(invoiceId))
            throw new ArgumentException("Invoice ID is required", nameof(invoiceId));

        return await ExecuteAsync(async () =>
        {
            // Get invoice header
            var headerEndpoint = $"/VendorInvoiceHeaders('{invoiceId}')";
            var header = await GetODataAsync<InvoiceHeaderDto>(headerEndpoint, cancellationToken);

            // Get invoice lines
            var linesEndpoint = $"/VendorInvoiceLines?$filter=InvoiceId eq '{invoiceId}'";
            var lines = await GetODataCollectionAsync<InvoiceLineDto>(linesEndpoint, cancellationToken);

            Logger.LogInformation(
                "Retrieved invoice {InvoiceId} with {LineCount} lines",
                invoiceId,
                lines.Count);

            return new InvoiceDetails
            {
                InvoiceId = header.InvoiceId ?? invoiceId,
                InvoiceNumber = header.InvoiceNumber,
                VendorAccount = header.InvoiceAccount,
                VendorName = header.VendorName,
                InvoiceDate = header.InvoiceDate,
                DueDate = header.DueDate,
                TotalAmount = header.InvoiceAmount,
                Currency = header.CurrencyCode,
                Status = header.ApprovalStatus,
                Description = header.Description,
                Lines = lines.Select((l, i) => new InvoiceLineInfo
                {
                    LineNumber = l.LineNumber ?? i + 1,
                    ItemNumber = l.ItemNumber,
                    Description = l.Description,
                    Quantity = l.Quantity,
                    UnitPrice = l.UnitPrice,
                    LineAmount = l.LineAmount,
                    Category = l.ProcurementCategory
                }).ToList()
            };
        }, "GetInvoice", cancellationToken);
    }

    private class InvoiceHeaderDto
    {
        public string? InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? InvoiceAccount { get; set; }
        public string? VendorName { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal? InvoiceAmount { get; set; }
        public string? CurrencyCode { get; set; }
        public string? ApprovalStatus { get; set; }
        public string? Description { get; set; }
    }

    private class InvoiceLineDto
    {
        public int? LineNumber { get; set; }
        public string? ItemNumber { get; set; }
        public string? Description { get; set; }
        public decimal? Quantity { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal? LineAmount { get; set; }
        public string? ProcurementCategory { get; set; }
    }
}

public record InvoiceDetails
{
    public required string InvoiceId { get; init; }
    public string? InvoiceNumber { get; init; }
    public string? VendorAccount { get; init; }
    public string? VendorName { get; init; }
    public DateTime? InvoiceDate { get; init; }
    public DateTime? DueDate { get; init; }
    public decimal? TotalAmount { get; init; }
    public string? Currency { get; init; }
    public string? Status { get; init; }
    public string? Description { get; init; }
    public List<InvoiceLineInfo>? Lines { get; init; }
}

public record InvoiceLineInfo
{
    public int LineNumber { get; init; }
    public string? ItemNumber { get; init; }
    public string? Description { get; init; }
    public decimal? Quantity { get; init; }
    public decimal? UnitPrice { get; init; }
    public decimal? LineAmount { get; init; }
    public string? Category { get; init; }
}
