namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Select a row in a grid
/// </summary>
public class SelectGridRowTool : FormToolBase
{
    public SelectGridRowTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<SelectGridRowTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<SelectGridRowResult> ExecuteAsync(string sessionId, string gridName, int rowIndex, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new { gridName, rowIndex };
            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"sessions/{sessionId}/grids/select", content, ct);
            response.EnsureSuccessStatusCode();

            return new SelectGridRowResult { SessionId = sessionId, GridName = gridName, RowIndex = rowIndex, Success = true };
        }, "SelectGridRow", ct);
    }
}

public record SelectGridRowResult
{
    public required string SessionId { get; init; }
    public required string GridName { get; init; }
    public int RowIndex { get; init; }
    public bool Success { get; init; }
}
