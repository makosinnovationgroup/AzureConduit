namespace AzureConduit.Mcp.D365.Tools.Finance;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Lists vendor invoices from D365 Finance.
/// </summary>
public class ListInvoicesTool : D365BaseService
{
    public ListInvoicesTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<ListInvoicesTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<ListInvoicesResult> ExecuteAsync(
        string? vendorAccount = null,
        string? status = null,
        int top = 100,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = BuildEndpoint(vendorAccount, status, top);
            var invoices = await GetODataCollectionAsync<InvoiceDto>(endpoint, cancellationToken);

            Logger.LogInformation(
                "Listed {Count} invoices from D365",
                invoices.Count);

            return new ListInvoicesResult
            {
                Invoices = invoices.Select(MapInvoice).ToList(),
                Count = invoices.Count
            };
        }, "ListInvoices", cancellationToken);
    }

    private static string BuildEndpoint(string? vendorAccount, string? status, int top)
    {
        var endpoint = $"/VendorInvoiceHeaders?$top={top}";
        var filters = new List<string>();

        if (!string.IsNullOrWhiteSpace(vendorAccount))
            filters.Add($"InvoiceAccount eq '{vendorAccount}'");

        if (!string.IsNullOrWhiteSpace(status))
            filters.Add($"ApprovalStatus eq '{status}'");

        if (filters.Count > 0)
            endpoint += $"&$filter={string.Join(" and ", filters)}";

        endpoint += "&$orderby=InvoiceDate desc";

        return endpoint;
    }

    private static InvoiceInfo MapInvoice(InvoiceDto dto) => new()
    {
        InvoiceId = dto.InvoiceId ?? "",
        InvoiceNumber = dto.InvoiceNumber,
        VendorAccount = dto.InvoiceAccount,
        VendorName = dto.VendorName,
        InvoiceDate = dto.InvoiceDate,
        DueDate = dto.DueDate,
        TotalAmount = dto.InvoiceAmount,
        Currency = dto.CurrencyCode,
        Status = dto.ApprovalStatus,
        Description = dto.Description
    };

    private class InvoiceDto
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
}

public record ListInvoicesResult
{
    public required List<InvoiceInfo> Invoices { get; init; }
    public int Count { get; init; }
}

public record InvoiceInfo
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
}
