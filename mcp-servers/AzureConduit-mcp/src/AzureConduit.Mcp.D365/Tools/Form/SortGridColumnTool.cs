namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Sort a grid by a column
/// </summary>
public class SortGridColumnTool : FormToolBase
{
    public SortGridColumnTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<SortGridColumnTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<SortGridColumnResult> ExecuteAsync(string sessionId, string gridName, string columnName, bool descending = false, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new { gridName, columnName, descending };
            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"sessions/{sessionId}/grids/sort", content, ct);
            response.EnsureSuccessStatusCode();

            return new SortGridColumnResult { SessionId = sessionId, GridName = gridName, ColumnName = columnName, Descending = descending, Success = true };
        }, "SortGridColumn", ct);
    }
}

public record SortGridColumnResult
{
    public required string SessionId { get; init; }
    public required string GridName { get; init; }
    public required string ColumnName { get; init; }
    public bool Descending { get; init; }
    public bool Success { get; init; }
}
