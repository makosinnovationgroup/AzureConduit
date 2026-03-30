namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Open or close a tab on the form
/// </summary>
public class OpenOrCloseTabTool : FormToolBase
{
    public OpenOrCloseTabTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<OpenOrCloseTabTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<OpenOrCloseTabResult> ExecuteAsync(string sessionId, string tabName, bool expand = true, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new { tabName, expand };
            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"sessions/{sessionId}/tabs/toggle", content, ct);
            response.EnsureSuccessStatusCode();

            return new OpenOrCloseTabResult { SessionId = sessionId, TabName = tabName, Expanded = expand, Success = true };
        }, "OpenOrCloseTab", ct);
    }
}

public record OpenOrCloseTabResult
{
    public required string SessionId { get; init; }
    public required string TabName { get; init; }
    public bool Expanded { get; init; }
    public bool Success { get; init; }
}
