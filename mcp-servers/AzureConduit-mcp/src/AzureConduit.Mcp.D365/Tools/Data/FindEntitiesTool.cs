namespace AzureConduit.Mcp.D365.Tools.Data;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Find or read data records using OData queries
/// </summary>
public class FindEntitiesTool : D365BaseService
{
    public FindEntitiesTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<FindEntitiesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<FindEntitiesResult> ExecuteAsync(
        string entityName,
        string? select = null,
        string? filter = null,
        string? orderBy = null,
        string? expand = null,
        int top = 50,
        int skip = 0,
        CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateD365ClientAsync(ct);

            var queryParams = new List<string> { $"$top={top}" };
            if (!string.IsNullOrEmpty(select)) queryParams.Add($"$select={select}");
            if (!string.IsNullOrEmpty(filter)) queryParams.Add($"$filter={filter}");
            if (!string.IsNullOrEmpty(orderBy)) queryParams.Add($"$orderby={orderBy}");
            if (!string.IsNullOrEmpty(expand)) queryParams.Add($"$expand={expand}");
            if (skip > 0) queryParams.Add($"$skip={skip}");
            queryParams.Add("$count=true");

            var url = $"{entityName}?{string.Join("&", queryParams)}";
            var response = await client.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<ODataResponse<JsonElement>>(content, JsonOptions);

            var records = result?.Value?.Select(r => r.EnumerateObject()
                .Where(p => !p.Name.StartsWith("@"))
                .ToDictionary(p => p.Name, p => GetValue(p.Value))).ToList() ?? new();

            return new FindEntitiesResult
            {
                EntityName = entityName,
                Records = records,
                Count = records.Count,
                TotalCount = result?.Count
            };
        }, "FindEntities", ct);
    }

    private static object? GetValue(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.String => e.GetString(),
        JsonValueKind.Number => e.TryGetInt64(out var l) ? l : e.GetDecimal(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => e.GetRawText()
    };
}

public record FindEntitiesResult
{
    public required string EntityName { get; init; }
    public required List<Dictionary<string, object?>> Records { get; init; }
    public int Count { get; init; }
    public long? TotalCount { get; init; }
}
