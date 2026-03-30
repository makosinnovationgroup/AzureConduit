namespace AzureConduit.Mcp.Dataverse.Tools;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class GetTableTool : DataverseBaseService
{
    public GetTableTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetTableTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<TableDetails> ExecuteAsync(string tableName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = $"EntityDefinitions(LogicalName='{tableName}')?$expand=Attributes($select=LogicalName,AttributeType,DisplayName)";
            var table = await GetAsync<TableDetailsDto>(endpoint, ct);
            return new TableDetails
            {
                LogicalName = table.LogicalName ?? tableName,
                DisplayName = table.DisplayName?.UserLocalizedLabel?.Label,
                PrimaryIdAttribute = table.PrimaryIdAttribute,
                PrimaryNameAttribute = table.PrimaryNameAttribute,
                Attributes = table.Attributes?.Take(50).Select(a => new AttributeInfo
                {
                    LogicalName = a.LogicalName ?? "",
                    Type = a.AttributeType,
                    DisplayName = a.DisplayName?.UserLocalizedLabel?.Label
                }).ToList() ?? new()
            };
        }, "GetTable", ct);
    }

    private class TableDetailsDto
    {
        public string? LogicalName { get; set; }
        public LocalizedLabel? DisplayName { get; set; }
        public string? PrimaryIdAttribute { get; set; }
        public string? PrimaryNameAttribute { get; set; }
        public List<AttributeDto>? Attributes { get; set; }
    }
    private class AttributeDto { public string? LogicalName { get; set; } public string? AttributeType { get; set; } public LocalizedLabel? DisplayName { get; set; } }
    private class LocalizedLabel { public UserLabel? UserLocalizedLabel { get; set; } }
    private class UserLabel { public string? Label { get; set; } }
}

public record TableDetails { public required string LogicalName { get; init; } public string? DisplayName { get; init; } public string? PrimaryIdAttribute { get; init; } public string? PrimaryNameAttribute { get; init; } public List<AttributeInfo>? Attributes { get; init; } }
public record AttributeInfo { public required string LogicalName { get; init; } public string? Type { get; init; } public string? DisplayName { get; init; } }
