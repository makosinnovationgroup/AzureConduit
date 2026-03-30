namespace AzureConduit.Mcp.D365.Tools.Finance;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Gets detailed vendor information from D365 Finance.
/// </summary>
public class GetVendorTool : D365BaseService
{
    public GetVendorTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<GetVendorTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<VendorDetails> ExecuteAsync(
        string vendorAccount,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(vendorAccount))
            throw new ArgumentException("Vendor account is required", nameof(vendorAccount));

        return await ExecuteAsync(async () =>
        {
            var endpoint = $"/Vendors(VendorAccountNumber='{vendorAccount}',dataAreaId='')";
            var vendor = await GetODataAsync<VendorDto>(endpoint, cancellationToken);

            Logger.LogInformation("Retrieved vendor {VendorAccount}", vendorAccount);

            return new VendorDetails
            {
                VendorAccount = vendor.VendorAccountNumber ?? vendorAccount,
                Name = vendor.VendorName,
                VendorGroup = vendor.VendorGroupId,
                PaymentTerms = vendor.PaymentTermsName,
                Currency = vendor.CurrencyCode,
                Email = vendor.PrimaryContactEmail,
                Phone = vendor.PrimaryContactPhone,
                Address = vendor.AddressDescription,
                TaxNumber = vendor.TaxExemptNumber,
                OnHold = vendor.VendorOnHoldStatus,
                CreditLimit = vendor.CreditLimit
            };
        }, "GetVendor", cancellationToken);
    }

    private class VendorDto
    {
        public string? VendorAccountNumber { get; set; }
        public string? VendorName { get; set; }
        public string? VendorGroupId { get; set; }
        public string? PaymentTermsName { get; set; }
        public string? CurrencyCode { get; set; }
        public string? PrimaryContactEmail { get; set; }
        public string? PrimaryContactPhone { get; set; }
        public string? AddressDescription { get; set; }
        public string? TaxExemptNumber { get; set; }
        public string? VendorOnHoldStatus { get; set; }
        public decimal? CreditLimit { get; set; }
    }
}

public record VendorDetails
{
    public required string VendorAccount { get; init; }
    public string? Name { get; init; }
    public string? VendorGroup { get; init; }
    public string? PaymentTerms { get; init; }
    public string? Currency { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Address { get; init; }
    public string? TaxNumber { get; init; }
    public string? OnHold { get; init; }
    public decimal? CreditLimit { get; init; }
}
