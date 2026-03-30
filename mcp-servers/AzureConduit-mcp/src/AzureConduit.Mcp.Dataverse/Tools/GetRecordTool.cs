namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class GetRecordTool : DataverseBaseService
{
    public GetRecordTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetRecordTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<GetRecordResult> ExecuteAsync(string tableName, string recordId, string? select = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var endpoint = $"{tableName}({recordId})";
            if (!string.IsNullOrEmpty(select)) endpoint += $"?$select={select}";

            var record = await GetAsync<JsonElement>(endpoint, ct);
            return new GetRecordResult
            {
                TableName = tableName,
                RecordId = recordId,
                Record = record.EnumerateObject()
                    .Where(p => !p.Name.StartsWith("@"))
                    .ToDictionary(p => p.Name, p => GetValue(p.Value))
            };
        }, "GetRecord", ct);
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

public record GetRecordResult { public required string TableName { get; init; } public required string RecordId { get; init; } public required Dictionary<string, object?> Record { get; init; } }
