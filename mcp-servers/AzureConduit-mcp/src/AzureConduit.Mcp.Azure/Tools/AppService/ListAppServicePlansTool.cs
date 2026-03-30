namespace AzureConduit.Mcp.Azure.Tools.AppService;

using Azure.ResourceManager;
using Azure.ResourceManager.AppService;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListAppServicePlansTool : OboEnabledBaseService
{
    public ListAppServicePlansTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListAppServicePlansTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListAppServicePlansResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var plans = new List<AppServicePlanSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var plan in rg.GetAppServicePlans().GetAllAsync(ct))
                {
                    plans.Add(MapPlan(plan));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var plan in sub.GetAppServicePlansAsync(ct))
                {
                    plans.Add(MapPlan(plan));
                }
            }

            return new ListAppServicePlansResult { Plans = plans, Count = plans.Count };
        }, "ListAppServicePlans", ct);
    }

    private static AppServicePlanSummary MapPlan(AppServicePlanResource plan) => new()
    {
        Id = plan.Id.ToString(),
        Name = plan.Data.Name,
        Location = plan.Data.Location?.Name ?? "",
        Sku = plan.Data.Sku?.Name ?? "",
        Tier = plan.Data.Sku?.Tier ?? "",
        NumberOfSites = plan.Data.NumberOfSites ?? 0
    };
}

public record ListAppServicePlansResult
{
    public required List<AppServicePlanSummary> Plans { get; init; }
    public int Count { get; init; }
}

public record AppServicePlanSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string Sku { get; init; }
    public required string Tier { get; init; }
    public int NumberOfSites { get; init; }
}
