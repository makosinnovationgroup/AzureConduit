namespace AzureConduit.Mcp.Azure.Tools.ContainerApps;

using Azure.ResourceManager;
using Azure.ResourceManager.AppContainers;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListContainerAppsTool : OboEnabledBaseService
{
    public ListContainerAppsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListContainerAppsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListContainerAppsResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var apps = new List<ContainerAppSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var app in rg.GetContainerApps().GetAllAsync(ct))
                {
                    apps.Add(MapApp(app));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var app in sub.GetContainerAppsAsync(ct))
                {
                    apps.Add(MapApp(app));
                }
            }

            return new ListContainerAppsResult { Apps = apps, Count = apps.Count };
        }, "ListContainerApps", ct);
    }

    private static ContainerAppSummary MapApp(ContainerAppResource app) => new()
    {
        Id = app.Id.ToString(),
        Name = app.Data.Name,
        Location = app.Data.Location?.Name ?? "",
        ProvisioningState = app.Data.ProvisioningState?.ToString() ?? "",
        LatestRevisionName = app.Data.LatestRevisionName ?? "",
        LatestRevisionFqdn = app.Data.LatestRevisionFqdn ?? "",
        ManagedEnvironmentId = app.Data.ManagedEnvironmentId?.ToString() ?? ""
    };
}

public record ListContainerAppsResult
{
    public required List<ContainerAppSummary> Apps { get; init; }
    public int Count { get; init; }
}

public record ContainerAppSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string ProvisioningState { get; init; }
    public required string LatestRevisionName { get; init; }
    public required string LatestRevisionFqdn { get; init; }
    public required string ManagedEnvironmentId { get; init; }
}
