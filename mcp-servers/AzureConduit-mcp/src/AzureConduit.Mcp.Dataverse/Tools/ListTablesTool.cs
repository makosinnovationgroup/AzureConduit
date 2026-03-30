namespace AzureConduit.Mcp.Dataverse.Tools;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class ListTablesTool : DataverseBaseService
{
    public ListTablesTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListTablesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ListTablesResult> ExecuteAsync(string? search = null, int top = 50, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = $"EntityDefinitions?$select=LogicalName,DisplayName,Description,PrimaryIdAttribute&$top={top}";
            if (!string.IsNullOrEmpty(search))
                endpoint += $"&$filter=contains(LogicalName,'{search}')";

            var tables = await GetCollectionAsync<TableDto>(endpoint, ct);
            return new ListTablesResult
            {
                Tables = tables.Select(t => new TableInfo
                {
                    LogicalName = t.LogicalName ?? "",
                    DisplayName = t.DisplayName?.UserLocalizedLabel?.Label,
                    Description = t.Description?.UserLocalizedLabel?.Label,
                    PrimaryIdAttribute = t.PrimaryIdAttribute
                }).ToList(),
                Count = tables.Count
            };
        }, "ListTables", ct);
    }

    private class TableDto
    {
        public string? LogicalName { get; set; }
        public LocalizedLabel? DisplayName { get; set; }
        public LocalizedLabel? Description { get; set; }
        public string? PrimaryIdAttribute { get; set; }
    }
    private class LocalizedLabel { public UserLabel? UserLocalizedLabel { get; set; } }
    private class UserLabel { public string? Label { get; set; } }
}

public record ListTablesResult { public required List<TableInfo> Tables { get; init; } public int Count { get; init; } }
public record TableInfo { public required string LogicalName { get; init; } public string? DisplayName { get; init; } public string? Description { get; init; } public string? PrimaryIdAttribute { get; init; } }
