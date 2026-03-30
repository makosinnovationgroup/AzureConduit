namespace AzureConduit.Mcp.Azure.Tools.AppService;

using Azure.ResourceManager;
using Azure.ResourceManager.AppService;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListWebAppsTool : OboEnabledBaseService
{
    public ListWebAppsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListWebAppsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListWebAppsResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var apps = new List<WebAppSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var app in rg.GetWebSites().GetAllAsync(ct))
                {
                    apps.Add(MapApp(app));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var app in sub.GetWebSitesAsync(ct))
                {
                    apps.Add(MapApp(app));
                }
            }

            return new ListWebAppsResult { WebApps = apps, Count = apps.Count };
        }, "ListWebApps", ct);
    }

    private static WebAppSummary MapApp(WebSiteResource app) => new()
    {
        Id = app.Id.ToString(),
        Name = app.Data.Name,
        Location = app.Data.Location?.Name ?? "",
        State = app.Data.State ?? "",
        DefaultHostName = app.Data.DefaultHostName ?? "",
        Kind = app.Data.Kind ?? ""
    };
}

public record ListWebAppsResult
{
    public required List<WebAppSummary> WebApps { get; init; }
    public int Count { get; init; }
}

public record WebAppSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string State { get; init; }
    public required string DefaultHostName { get; init; }
    public required string Kind { get; init; }
}
