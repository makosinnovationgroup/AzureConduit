namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Set values on one or more form controls
/// </summary>
public class SetControlValuesTool : FormToolBase
{
    public SetControlValuesTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<SetControlValuesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<SetControlValuesResult> ExecuteAsync(string sessionId, Dictionary<string, object> values, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new { values };
            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"sessions/{sessionId}/controls/values", content, ct);
            response.EnsureSuccessStatusCode();

            return new SetControlValuesResult { SessionId = sessionId, Success = true, FieldsSet = values.Count };
        }, "SetControlValues", ct);
    }
}

public record SetControlValuesResult
{
    public required string SessionId { get; init; }
    public bool Success { get; init; }
    public int FieldsSet { get; init; }
}
