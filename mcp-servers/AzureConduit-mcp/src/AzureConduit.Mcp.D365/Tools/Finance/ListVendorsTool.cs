namespace AzureConduit.Mcp.D365.Tools.Finance;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Lists vendors from D365 Finance.
/// </summary>
public class ListVendorsTool : D365BaseService
{
    public ListVendorsTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<ListVendorsTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<ListVendorsResult> ExecuteAsync(
        string? search = null,
        string? vendorGroup = null,
        int top = 100,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = BuildEndpoint(search, vendorGroup, top);
            var vendors = await GetODataCollectionAsync<VendorDto>(endpoint, cancellationToken);

            Logger.LogInformation("Listed {Count} vendors from D365", vendors.Count);

            return new ListVendorsResult
            {
                Vendors = vendors.Select(MapVendor).ToList(),
                Count = vendors.Count
            };
        }, "ListVendors", cancellationToken);
    }

    private static string BuildEndpoint(string? search, string? vendorGroup, int top)
    {
        var endpoint = $"/Vendors?$top={top}&$select=VendorAccountNumber,VendorName,VendorGroupId,PaymentTermsName,CurrencyCode,PrimaryContactEmail";
        var filters = new List<string>();

        if (!string.IsNullOrWhiteSpace(search))
            filters.Add($"contains(VendorName, '{search}') or contains(VendorAccountNumber, '{search}')");

        if (!string.IsNullOrWhiteSpace(vendorGroup))
            filters.Add($"VendorGroupId eq '{vendorGroup}'");

        if (filters.Count > 0)
            endpoint += $"&$filter={string.Join(" and ", filters)}";

        return endpoint;
    }

    private static VendorInfo MapVendor(VendorDto dto) => new()
    {
        VendorAccount = dto.VendorAccountNumber ?? "",
        Name = dto.VendorName,
        VendorGroup = dto.VendorGroupId,
        PaymentTerms = dto.PaymentTermsName,
        Currency = dto.CurrencyCode,
        Email = dto.PrimaryContactEmail
    };

    private class VendorDto
    {
        public string? VendorAccountNumber { get; set; }
        public string? VendorName { get; set; }
        public string? VendorGroupId { get; set; }
        public string? PaymentTermsName { get; set; }
        public string? CurrencyCode { get; set; }
        public string? PrimaryContactEmail { get; set; }
    }
}

public record ListVendorsResult
{
    public required List<VendorInfo> Vendors { get; init; }
    public int Count { get; init; }
}

public record VendorInfo
{
    public required string VendorAccount { get; init; }
    public string? Name { get; init; }
    public string? VendorGroup { get; init; }
    public string? PaymentTerms { get; init; }
    public string? Currency { get; init; }
    public string? Email { get; init; }
}
