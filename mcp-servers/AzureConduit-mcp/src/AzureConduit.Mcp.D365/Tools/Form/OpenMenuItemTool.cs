namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Open a menu item (form) in D365
/// </summary>
public class OpenMenuItemTool : FormToolBase
{
    public OpenMenuItemTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<OpenMenuItemTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<OpenMenuItemResult> ExecuteAsync(string menuItemName, string? company = null, Dictionary<string, string>? args = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var request = new
            {
                menuItemName,
                company,
                args
            };

            var json = JsonSerializer.Serialize(request, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync("sessions/open", content, ct);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<JsonElement>(responseContent, JsonOptions);

            return new OpenMenuItemResult
            {
                SessionId = result.TryGetProperty("sessionId", out var sid) ? sid.GetString() ?? "" : "",
                FormName = menuItemName,
                Success = true
            };
        }, "OpenMenuItem", ct);
    }
}

public record OpenMenuItemResult
{
    public required string SessionId { get; init; }
    public required string FormName { get; init; }
    public bool Success { get; init; }
}
