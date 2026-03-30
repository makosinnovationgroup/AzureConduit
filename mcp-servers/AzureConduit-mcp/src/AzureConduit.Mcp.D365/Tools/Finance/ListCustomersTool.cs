namespace AzureConduit.Mcp.D365.Tools.Finance;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Lists customers from D365 Finance.
/// </summary>
public class ListCustomersTool : D365BaseService
{
    public ListCustomersTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<ListCustomersTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<ListCustomersResult> ExecuteAsync(
        string? search = null,
        string? customerGroup = null,
        int top = 100,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = BuildEndpoint(search, customerGroup, top);
            var customers = await GetODataCollectionAsync<CustomerDto>(endpoint, cancellationToken);

            Logger.LogInformation("Listed {Count} customers from D365", customers.Count);

            return new ListCustomersResult
            {
                Customers = customers.Select(MapCustomer).ToList(),
                Count = customers.Count
            };
        }, "ListCustomers", cancellationToken);
    }

    private static string BuildEndpoint(string? search, string? customerGroup, int top)
    {
        var endpoint = $"/CustomersV3?$top={top}&$select=CustomerAccount,CustomerName,CustomerGroupId,PaymentTermsName,CurrencyCode,PrimaryContactEmail";
        var filters = new List<string>();

        if (!string.IsNullOrWhiteSpace(search))
            filters.Add($"contains(CustomerName, '{search}') or contains(CustomerAccount, '{search}')");

        if (!string.IsNullOrWhiteSpace(customerGroup))
            filters.Add($"CustomerGroupId eq '{customerGroup}'");

        if (filters.Count > 0)
            endpoint += $"&$filter={string.Join(" and ", filters)}";

        return endpoint;
    }

    private static CustomerInfo MapCustomer(CustomerDto dto) => new()
    {
        CustomerAccount = dto.CustomerAccount ?? "",
        Name = dto.CustomerName,
        CustomerGroup = dto.CustomerGroupId,
        PaymentTerms = dto.PaymentTermsName,
        Currency = dto.CurrencyCode,
        Email = dto.PrimaryContactEmail
    };

    private class CustomerDto
    {
        public string? CustomerAccount { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerGroupId { get; set; }
        public string? PaymentTermsName { get; set; }
        public string? CurrencyCode { get; set; }
        public string? PrimaryContactEmail { get; set; }
    }
}

public record ListCustomersResult
{
    public required List<CustomerInfo> Customers { get; init; }
    public int Count { get; init; }
}

public record CustomerInfo
{
    public required string CustomerAccount { get; init; }
    public string? Name { get; init; }
    public string? CustomerGroup { get; init; }
    public string? PaymentTerms { get; init; }
    public string? Currency { get; init; }
    public string? Email { get; init; }
}
