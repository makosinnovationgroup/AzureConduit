namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class QueryTool : DataverseBaseService
{
    public QueryTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<QueryTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<QueryResult> ExecuteAsync(string fetchXml, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateDataverseClientAsync(ct);
            var encoded = Uri.EscapeDataString(fetchXml);
            var response = await client.GetAsync($"?fetchXml={encoded}", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<ODataResponse<JsonElement>>(content, JsonOptions);

            return new QueryResult
            {
                Records = result?.Value?.Select(r => r.EnumerateObject()
                    .Where(p => !p.Name.StartsWith("@"))
                    .ToDictionary(p => p.Name, p => GetValue(p.Value))).ToList() ?? new(),
                Count = result?.Value?.Count ?? 0
            };
        }, "Query", ct);
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

public record QueryResult { public required List<Dictionary<string, object?>> Records { get; init; } public int Count { get; init; } }
