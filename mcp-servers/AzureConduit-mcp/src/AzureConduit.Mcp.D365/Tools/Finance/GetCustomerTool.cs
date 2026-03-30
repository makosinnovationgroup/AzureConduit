namespace AzureConduit.Mcp.D365.Tools.Finance;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Gets detailed customer information from D365 Finance.
/// </summary>
public class GetCustomerTool : D365BaseService
{
    public GetCustomerTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<GetCustomerTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<CustomerDetails> ExecuteAsync(
        string customerAccount,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(customerAccount))
            throw new ArgumentException("Customer account is required", nameof(customerAccount));

        return await ExecuteAsync(async () =>
        {
            var endpoint = $"/CustomersV3(CustomerAccount='{customerAccount}',dataAreaId='')";
            var customer = await GetODataAsync<CustomerDto>(endpoint, cancellationToken);

            Logger.LogInformation("Retrieved customer {CustomerAccount}", customerAccount);

            return new CustomerDetails
            {
                CustomerAccount = customer.CustomerAccount ?? customerAccount,
                Name = customer.CustomerName,
                CustomerGroup = customer.CustomerGroupId,
                PaymentTerms = customer.PaymentTermsName,
                Currency = customer.CurrencyCode,
                Email = customer.PrimaryContactEmail,
                Phone = customer.PrimaryContactPhone,
                Address = customer.FullPrimaryAddress,
                TaxNumber = customer.TaxExemptNumber,
                CreditLimit = customer.CreditLimit,
                OnHold = customer.CreditHold
            };
        }, "GetCustomer", cancellationToken);
    }

    private class CustomerDto
    {
        public string? CustomerAccount { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerGroupId { get; set; }
        public string? PaymentTermsName { get; set; }
        public string? CurrencyCode { get; set; }
        public string? PrimaryContactEmail { get; set; }
        public string? PrimaryContactPhone { get; set; }
        public string? FullPrimaryAddress { get; set; }
        public string? TaxExemptNumber { get; set; }
        public decimal? CreditLimit { get; set; }
        public string? CreditHold { get; set; }
    }
}

public record CustomerDetails
{
    public required string CustomerAccount { get; init; }
    public string? Name { get; init; }
    public string? CustomerGroup { get; init; }
    public string? PaymentTerms { get; init; }
    public string? Currency { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Address { get; init; }
    public string? TaxNumber { get; init; }
    public decimal? CreditLimit { get; init; }
    public string? OnHold { get; init; }
}
