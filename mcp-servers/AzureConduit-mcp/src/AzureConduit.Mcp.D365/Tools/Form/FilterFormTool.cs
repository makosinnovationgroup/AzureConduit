namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Apply a filter on the form
/// </summary>
public class FilterFormTool : FormToolBase
{
    public FilterFormTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<FilterFormTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<FilterFormResult> ExecuteAsync(string sessionId, string filterExpression, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new { filter = filterExpression };
            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"sessions/{sessionId}/filter", content, ct);
            response.EnsureSuccessStatusCode();

            return new FilterFormResult { SessionId = sessionId, FilterApplied = filterExpression, Success = true };
        }, "FilterForm", ct);
    }
}

public record FilterFormResult
{
    public required string SessionId { get; init; }
    public required string FilterApplied { get; init; }
    public bool Success { get; init; }
}
