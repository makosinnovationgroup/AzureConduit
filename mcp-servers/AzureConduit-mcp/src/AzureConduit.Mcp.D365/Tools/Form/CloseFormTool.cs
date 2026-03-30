namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Close the current form/session
/// </summary>
public class CloseFormTool : FormToolBase
{
    public CloseFormTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<CloseFormTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<CloseFormResult> ExecuteAsync(string sessionId, bool saveBeforeClose = false, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new { saveBeforeClose };
            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"sessions/{sessionId}/close", content, ct);
            response.EnsureSuccessStatusCode();

            return new CloseFormResult { SessionId = sessionId, Success = true };
        }, "CloseForm", ct);
    }
}

public record CloseFormResult
{
    public required string SessionId { get; init; }
    public bool Success { get; init; }
}
