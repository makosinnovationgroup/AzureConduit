namespace AzureConduit.Mcp.Azure.Tools.Monitor;

using Azure.ResourceManager;
using Azure.ResourceManager.OperationalInsights;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListLogAnalyticsWorkspacesTool : OboEnabledBaseService
{
    public ListLogAnalyticsWorkspacesTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListLogAnalyticsWorkspacesTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListLogAnalyticsWorkspacesResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var workspaces = new List<LogAnalyticsWorkspaceSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var workspace in rg.GetOperationalInsightsWorkspaces().GetAllAsync(ct))
                {
                    workspaces.Add(MapWorkspace(workspace));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var workspace in sub.GetOperationalInsightsWorkspacesAsync(ct))
                {
                    workspaces.Add(MapWorkspace(workspace));
                }
            }

            return new ListLogAnalyticsWorkspacesResult { Workspaces = workspaces, Count = workspaces.Count };
        }, "ListLogAnalyticsWorkspaces", ct);
    }

    private static LogAnalyticsWorkspaceSummary MapWorkspace(OperationalInsightsWorkspaceResource workspace) => new()
    {
        Id = workspace.Id.ToString(),
        Name = workspace.Data.Name,
        Location = workspace.Data.Location?.Name ?? "",
        CustomerId = workspace.Data.CustomerId?.ToString() ?? "",
        Sku = workspace.Data.Sku?.Name.ToString() ?? "",
        RetentionInDays = workspace.Data.RetentionInDays ?? 0
    };
}

public record ListLogAnalyticsWorkspacesResult
{
    public required List<LogAnalyticsWorkspaceSummary> Workspaces { get; init; }
    public int Count { get; init; }
}

public record LogAnalyticsWorkspaceSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string CustomerId { get; init; }
    public required string Sku { get; init; }
    public int RetentionInDays { get; init; }
}
