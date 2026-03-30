namespace AzureConduit.Mcp.Azure.Tools.Functions;

using Azure.ResourceManager;
using Azure.ResourceManager.AppService;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListFunctionAppsTool : OboEnabledBaseService
{
    public ListFunctionAppsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListFunctionAppsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListFunctionAppsResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var apps = new List<FunctionAppSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var app in rg.GetWebSites().GetAllAsync(ct))
                {
                    if (app.Data.Kind?.Contains("functionapp", StringComparison.OrdinalIgnoreCase) == true)
                    {
                        apps.Add(MapApp(app));
                    }
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var app in sub.GetWebSitesAsync(ct))
                {
                    if (app.Data.Kind?.Contains("functionapp", StringComparison.OrdinalIgnoreCase) == true)
                    {
                        apps.Add(MapApp(app));
                    }
                }
            }

            return new ListFunctionAppsResult { FunctionApps = apps, Count = apps.Count };
        }, "ListFunctionApps", ct);
    }

    private static FunctionAppSummary MapApp(WebSiteResource app) => new()
    {
        Id = app.Id.ToString(),
        Name = app.Data.Name,
        Location = app.Data.Location?.Name ?? "",
        State = app.Data.State ?? "",
        DefaultHostName = app.Data.DefaultHostName ?? "",
        Kind = app.Data.Kind ?? ""
    };
}

public record ListFunctionAppsResult
{
    public required List<FunctionAppSummary> FunctionApps { get; init; }
    public int Count { get; init; }
}

public record FunctionAppSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string State { get; init; }
    public required string DefaultHostName { get; init; }
    public required string Kind { get; init; }
}
