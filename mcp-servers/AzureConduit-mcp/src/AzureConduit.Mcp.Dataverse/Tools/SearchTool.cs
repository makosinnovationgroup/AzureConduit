namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class SearchTool : DataverseBaseService
{
    public SearchTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<SearchTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    /// <summary>
    /// Keyword-based search across Dataverse for specific records using Dataverse Search API
    /// </summary>
    public async Task<SearchResult> ExecuteAsync(string searchTerm, string? entities = null, int top = 50, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateDataverseClientAsync(ct);

            var searchRequest = new Dictionary<string, object>
            {
                ["search"] = searchTerm,
                ["top"] = top
            };

            if (!string.IsNullOrEmpty(entities))
            {
                searchRequest["entities"] = entities.Split(',').Select(e => e.Trim()).ToArray();
            }

            var json = JsonSerializer.Serialize(searchRequest, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Dataverse Search API endpoint
            var response = await client.PostAsync("search/query", content, ct);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<SearchResponse>(responseContent, JsonOptions);

            return new SearchResult
            {
                Results = result?.Value?.Select(r => new SearchResultItem
                {
                    EntityName = r.EntityName ?? "",
                    ObjectId = r.ObjectId ?? "",
                    Score = r.Score,
                    Highlights = r.Highlights ?? new Dictionary<string, List<string>>(),
                    Attributes = r.Attributes ?? new Dictionary<string, object?>()
                }).ToList() ?? new(),
                TotalCount = result?.TotalRecordCount ?? 0
            };
        }, "Search", ct);
    }
}

public record SearchResult
{
    public required List<SearchResultItem> Results { get; init; }
    public long TotalCount { get; init; }
}

public record SearchResultItem
{
    public required string EntityName { get; init; }
    public required string ObjectId { get; init; }
    public double Score { get; init; }
    public Dictionary<string, List<string>> Highlights { get; init; } = new();
    public Dictionary<string, object?> Attributes { get; init; } = new();
}

internal record SearchResponse
{
    public List<SearchResponseItem>? Value { get; init; }
    public long TotalRecordCount { get; init; }
}

internal record SearchResponseItem
{
    public string? EntityName { get; init; }
    public string? ObjectId { get; init; }
    public double Score { get; init; }
    public Dictionary<string, List<string>>? Highlights { get; init; }
    public Dictionary<string, object?>? Attributes { get; init; }
}
