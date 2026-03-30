namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class ListRecordsTool : DataverseBaseService
{
    public ListRecordsTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListRecordsTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ListRecordsResult> ExecuteAsync(string tableName, string? select = null, string? filter = null, int top = 50, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = $"{tableName}?$top={top}";
            if (!string.IsNullOrEmpty(select)) endpoint += $"&$select={select}";
            if (!string.IsNullOrEmpty(filter)) endpoint += $"&$filter={Uri.EscapeDataString(filter)}";

            var records = await GetCollectionAsync<JsonElement>(endpoint, ct);
            return new ListRecordsResult
            {
                TableName = tableName,
                Records = records.Select(r => r.EnumerateObject()
                    .Where(p => !p.Name.StartsWith("@"))
                    .ToDictionary(p => p.Name, p => GetValue(p.Value))).ToList(),
                Count = records.Count
            };
        }, "ListRecords", ct);
    }

    private static object? GetValue(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.String => e.GetString(),
        JsonValueKind.Number => e.TryGetInt64(out var l) ? l : e.GetDecimal(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        _ => null
    };
}

public record ListRecordsResult { public required string TableName { get; init; } public required List<Dictionary<string, object?>> Records { get; init; } public int Count { get; init; } }
