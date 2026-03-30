namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Open a lookup control on the form
/// </summary>
public class OpenLookupTool : FormToolBase
{
    public OpenLookupTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<OpenLookupTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<OpenLookupResult> ExecuteAsync(string sessionId, string controlName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new { controlName };
            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"sessions/{sessionId}/lookups/open", content, ct);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<JsonElement>(responseContent, JsonOptions);

            var items = new List<LookupItem>();
            if (result.TryGetProperty("items", out var itemsArray))
            {
                foreach (var item in itemsArray.EnumerateArray())
                {
                    items.Add(new LookupItem
                    {
                        Id = item.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
                        Text = item.TryGetProperty("text", out var txt) ? txt.GetString() ?? "" : ""
                    });
                }
            }

            return new OpenLookupResult { SessionId = sessionId, ControlName = controlName, Items = items, Success = true };
        }, "OpenLookup", ct);
    }
}

public record OpenLookupResult
{
    public required string SessionId { get; init; }
    public required string ControlName { get; init; }
    public required List<LookupItem> Items { get; init; }
    public bool Success { get; init; }
}

public record LookupItem
{
    public required string Id { get; init; }
    public required string Text { get; init; }
}
