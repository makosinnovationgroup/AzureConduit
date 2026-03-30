namespace AzureConduit.Mcp.D365.Tools.Finance;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Lists vendor payments from D365 Finance.
/// </summary>
public class ListPaymentsTool : D365BaseService
{
    public ListPaymentsTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<ListPaymentsTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<ListPaymentsResult> ExecuteAsync(
        string? vendorAccount = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        int top = 100,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = BuildEndpoint(vendorAccount, fromDate, toDate, top);
            var payments = await GetODataCollectionAsync<PaymentDto>(endpoint, cancellationToken);

            Logger.LogInformation("Listed {Count} payments from D365", payments.Count);

            return new ListPaymentsResult
            {
                Payments = payments.Select(MapPayment).ToList(),
                Count = payments.Count
            };
        }, "ListPayments", cancellationToken);
    }

    private static string BuildEndpoint(string? vendorAccount, DateTime? fromDate, DateTime? toDate, int top)
    {
        var endpoint = $"/VendorPaymentJournalLines?$top={top}";
        var filters = new List<string>();

        if (!string.IsNullOrWhiteSpace(vendorAccount))
            filters.Add($"AccountNumber eq '{vendorAccount}'");

        if (fromDate.HasValue)
            filters.Add($"TransactionDate ge {fromDate.Value:yyyy-MM-dd}");

        if (toDate.HasValue)
            filters.Add($"TransactionDate le {toDate.Value:yyyy-MM-dd}");

        if (filters.Count > 0)
            endpoint += $"&$filter={string.Join(" and ", filters)}";

        endpoint += "&$orderby=TransactionDate desc";

        return endpoint;
    }

    private static PaymentInfo MapPayment(PaymentDto dto) => new()
    {
        JournalNumber = dto.JournalBatchNumber ?? "",
        VoucherNumber = dto.Voucher,
        VendorAccount = dto.AccountNumber,
        TransactionDate = dto.TransactionDate,
        Amount = dto.AmountCurDebit > 0 ? dto.AmountCurDebit : dto.AmountCurCredit,
        Currency = dto.CurrencyCode,
        PaymentMethod = dto.MethodOfPayment,
        Status = dto.PaymentStatus,
        Description = dto.Description
    };

    private class PaymentDto
    {
        public string? JournalBatchNumber { get; set; }
        public string? Voucher { get; set; }
        public string? AccountNumber { get; set; }
        public DateTime? TransactionDate { get; set; }
        public decimal? AmountCurDebit { get; set; }
        public decimal? AmountCurCredit { get; set; }
        public string? CurrencyCode { get; set; }
        public string? MethodOfPayment { get; set; }
        public string? PaymentStatus { get; set; }
        public string? Description { get; set; }
    }
}

public record ListPaymentsResult
{
    public required List<PaymentInfo> Payments { get; init; }
    public int Count { get; init; }
}

public record PaymentInfo
{
    public required string JournalNumber { get; init; }
    public string? VoucherNumber { get; init; }
    public string? VendorAccount { get; init; }
    public DateTime? TransactionDate { get; init; }
    public decimal? Amount { get; init; }
    public string? Currency { get; init; }
    public string? PaymentMethod { get; init; }
    public string? Status { get; init; }
    public string? Description { get; init; }
}
