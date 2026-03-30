namespace AzureConduit.Mcp.Azure.Tools.Monitor;

using Azure.ResourceManager;
using Azure.ResourceManager.ApplicationInsights;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListApplicationInsightsTool : OboEnabledBaseService
{
    public ListApplicationInsightsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListApplicationInsightsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListApplicationInsightsResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var components = new List<ApplicationInsightsSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var component in rg.GetApplicationInsightsComponents().GetAllAsync(ct))
                {
                    components.Add(MapComponent(component));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var component in sub.GetApplicationInsightsComponentsAsync(ct))
                {
                    components.Add(MapComponent(component));
                }
            }

            return new ListApplicationInsightsResult { Components = components, Count = components.Count };
        }, "ListApplicationInsights", ct);
    }

    private static ApplicationInsightsSummary MapComponent(ApplicationInsightsComponentResource component) => new()
    {
        Id = component.Id.ToString(),
        Name = component.Data.Name,
        Location = component.Data.Location?.Name ?? "",
        ApplicationType = component.Data.ApplicationType?.ToString() ?? "",
        InstrumentationKey = component.Data.InstrumentationKey ?? "",
        ConnectionString = component.Data.ConnectionString ?? ""
    };
}

public record ListApplicationInsightsResult
{
    public required List<ApplicationInsightsSummary> Components { get; init; }
    public int Count { get; init; }
}

public record ApplicationInsightsSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string ApplicationType { get; init; }
    public required string InstrumentationKey { get; init; }
    public required string ConnectionString { get; init; }
}
