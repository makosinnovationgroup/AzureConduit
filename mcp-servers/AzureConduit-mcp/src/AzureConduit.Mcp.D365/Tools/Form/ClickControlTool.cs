namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Click a control or button on the form
/// </summary>
public class ClickControlTool : FormToolBase
{
    public ClickControlTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<ClickControlTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ClickControlResult> ExecuteAsync(string sessionId, string controlName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new { controlName };
            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"sessions/{sessionId}/controls/click", content, ct);
            response.EnsureSuccessStatusCode();

            return new ClickControlResult { SessionId = sessionId, ControlName = controlName, Success = true };
        }, "ClickControl", ct);
    }
}

public record ClickControlResult
{
    public required string SessionId { get; init; }
    public required string ControlName { get; init; }
    public bool Success { get; init; }
}
