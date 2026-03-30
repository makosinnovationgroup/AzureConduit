namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Find a menu item in D365
/// </summary>
public class FindMenuItemTool : FormToolBase
{
    public FindMenuItemTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<FindMenuItemTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<FindMenuItemResult> ExecuteAsync(string search, int top = 20, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFormClientAsync(ct);

            var response = await client.GetAsync($"menuitems?search={Uri.EscapeDataString(search)}&top={top}", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<JsonElement>(content, JsonOptions);

            var menuItems = new List<MenuItemSummary>();
            if (result.TryGetProperty("value", out var items))
            {
                foreach (var item in items.EnumerateArray())
                {
                    menuItems.Add(new MenuItemSummary
                    {
                        Name = item.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "",
                        Label = item.TryGetProperty("label", out var l) ? l.GetString() ?? "" : "",
                        Type = item.TryGetProperty("type", out var t) ? t.GetString() ?? "" : ""
                    });
                }
            }

            return new FindMenuItemResult { MenuItems = menuItems, Count = menuItems.Count };
        }, "FindMenuItem", ct);
    }
}

public record FindMenuItemResult
{
    public required List<MenuItemSummary> MenuItems { get; init; }
    public int Count { get; init; }
}

public record MenuItemSummary
{
    public required string Name { get; init; }
    public required string Label { get; init; }
    public required string Type { get; init; }
}
