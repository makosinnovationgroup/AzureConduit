namespace AzureConduit.Mcp.D365.Tools.Common;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Executes a custom OData query against any D365 entity.
/// Useful for advanced queries not covered by specific tools.
/// </summary>
public class QueryEntitiesTool : D365BaseService
{
    public QueryEntitiesTool(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger<QueryEntitiesTool> logger)
        : base(credentialProvider, d365Config, httpClientFactory, logger)
    {
    }

    public async Task<QueryEntitiesResult> ExecuteAsync(
        string entityName,
        string? filter = null,
        string? select = null,
        string? orderBy = null,
        int top = 100,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(entityName))
            throw new ArgumentException("Entity name is required", nameof(entityName));

        return await ExecuteAsync(async () =>
        {
            var endpoint = BuildEndpoint(entityName, filter, select, orderBy, top);
            var response = await GetODataAsync<JsonElement>(endpoint, cancellationToken);

            // Extract the value array from OData response
            var entities = new List<Dictionary<string, object?>>();
            if (response.TryGetProperty("value", out var valueElement) && valueElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in valueElement.EnumerateArray())
                {
                    var entity = new Dictionary<string, object?>();
                    foreach (var property in item.EnumerateObject())
                    {
                        // Skip OData metadata properties
                        if (property.Name.StartsWith("@odata."))
                            continue;

                        entity[property.Name] = GetJsonValue(property.Value);
                    }
                    entities.Add(entity);
                }
            }

            Logger.LogInformation(
                "Queried {Count} records from entity {EntityName}",
                entities.Count,
                entityName);

            return new QueryEntitiesResult
            {
                EntityName = entityName,
                Records = entities,
                Count = entities.Count
            };
        }, "QueryEntities", cancellationToken);
    }

    private static string BuildEndpoint(string entityName, string? filter, string? select, string? orderBy, int top)
    {
        var endpoint = $"/{entityName}?$top={top}";

        if (!string.IsNullOrWhiteSpace(filter))
            endpoint += $"&$filter={Uri.EscapeDataString(filter)}";

        if (!string.IsNullOrWhiteSpace(select))
            endpoint += $"&$select={select}";

        if (!string.IsNullOrWhiteSpace(orderBy))
            endpoint += $"&$orderby={orderBy}";

        return endpoint;
    }

    private static object? GetJsonValue(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDecimal(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => element.GetRawText()
        };
    }
}

public record QueryEntitiesResult
{
    public required string EntityName { get; init; }
    public required List<Dictionary<string, object?>> Records { get; init; }
    public int Count { get; init; }
}
