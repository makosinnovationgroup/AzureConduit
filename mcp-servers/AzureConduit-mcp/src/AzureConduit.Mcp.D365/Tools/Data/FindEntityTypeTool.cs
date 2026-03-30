namespace AzureConduit.Mcp.D365.Tools.Data;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Find OData entity types matching a search term
/// </summary>
public class FindEntityTypeTool : D365BaseService
{
    public FindEntityTypeTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<FindEntityTypeTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<FindEntityTypeResult> ExecuteAsync(string? search = null, int top = 50, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateD365ClientAsync(ct);

            // Query the metadata endpoint for entity sets
            var response = await client.GetAsync("", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var metadata = JsonSerializer.Deserialize<JsonElement>(content, JsonOptions);

            var entities = new List<EntityTypeSummary>();

            if (metadata.TryGetProperty("value", out var value))
            {
                foreach (var item in value.EnumerateArray())
                {
                    var name = item.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    var url = item.TryGetProperty("url", out var u) ? u.GetString() ?? "" : "";

                    if (string.IsNullOrEmpty(search) ||
                        name.Contains(search, StringComparison.OrdinalIgnoreCase))
                    {
                        entities.Add(new EntityTypeSummary
                        {
                            Name = name,
                            Url = url
                        });

                        if (entities.Count >= top) break;
                    }
                }
            }

            return new FindEntityTypeResult { Entities = entities, Count = entities.Count };
        }, "FindEntityType", ct);
    }
}

public record FindEntityTypeResult
{
    public required List<EntityTypeSummary> Entities { get; init; }
    public int Count { get; init; }
}

public record EntityTypeSummary
{
    public required string Name { get; init; }
    public required string Url { get; init; }
}
