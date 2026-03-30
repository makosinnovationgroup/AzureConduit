namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Save the current form
/// </summary>
public class SaveFormTool : FormToolBase
{
    public SaveFormTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<SaveFormTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<SaveFormResult> ExecuteAsync(string sessionId, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var content = new StringContent("{}", Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"sessions/{sessionId}/save", content, ct);
            response.EnsureSuccessStatusCode();

            return new SaveFormResult { SessionId = sessionId, Success = true };
        }, "SaveForm", ct);
    }
}

public record SaveFormResult
{
    public required string SessionId { get; init; }
    public bool Success { get; init; }
}
