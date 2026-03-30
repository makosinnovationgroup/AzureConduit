namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Filter on a grid control
/// </summary>
public class FilterGridTool : FormToolBase
{
    public FilterGridTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<FilterGridTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<FilterGridResult> ExecuteAsync(string sessionId, string gridName, string columnName, string filterValue, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new { gridName, columnName, filterValue };
            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"sessions/{sessionId}/grids/filter", content, ct);
            response.EnsureSuccessStatusCode();

            return new FilterGridResult { SessionId = sessionId, GridName = gridName, ColumnName = columnName, FilterValue = filterValue, Success = true };
        }, "FilterGrid", ct);
    }
}

public record FilterGridResult
{
    public required string SessionId { get; init; }
    public required string GridName { get; init; }
    public required string ColumnName { get; init; }
    public required string FilterValue { get; init; }
    public bool Success { get; init; }
}
