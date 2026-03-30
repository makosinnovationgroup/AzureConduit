namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Find controls on the current form
/// </summary>
public class FindControlsTool : FormToolBase
{
    public FindControlsTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<FindControlsTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<FindControlsResult> ExecuteAsync(string sessionId, string? search = null, string? controlType = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var query = $"sessions/{sessionId}/controls";
            var queryParams = new List<string>();
            if (!string.IsNullOrEmpty(search)) queryParams.Add($"search={Uri.EscapeDataString(search)}");
            if (!string.IsNullOrEmpty(controlType)) queryParams.Add($"type={Uri.EscapeDataString(controlType)}");
            if (queryParams.Count > 0) query += "?" + string.Join("&", queryParams);

            var response = await client.GetAsync(query, ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<JsonElement>(content, JsonOptions);

            var controls = new List<ControlInfo>();
            if (result.TryGetProperty("value", out var items))
            {
                foreach (var item in items.EnumerateArray())
                {
                    controls.Add(new ControlInfo
                    {
                        Name = item.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "",
                        Label = item.TryGetProperty("label", out var l) ? l.GetString() ?? "" : "",
                        Type = item.TryGetProperty("type", out var t) ? t.GetString() ?? "" : "",
                        Value = item.TryGetProperty("value", out var v) ? v.GetString() : null,
                        IsEnabled = item.TryGetProperty("isEnabled", out var e) && e.GetBoolean(),
                        IsVisible = item.TryGetProperty("isVisible", out var vis) && vis.GetBoolean()
                    });
                }
            }

            return new FindControlsResult { Controls = controls, Count = controls.Count };
        }, "FindControls", ct);
    }
}

public record FindControlsResult
{
    public required List<ControlInfo> Controls { get; init; }
    public int Count { get; init; }
}

public record ControlInfo
{
    public required string Name { get; init; }
    public required string Label { get; init; }
    public required string Type { get; init; }
    public string? Value { get; init; }
    public bool IsEnabled { get; init; }
    public bool IsVisible { get; init; }
}
