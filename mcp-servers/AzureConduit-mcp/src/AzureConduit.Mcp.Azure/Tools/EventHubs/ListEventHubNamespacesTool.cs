namespace AzureConduit.Mcp.Azure.Tools.EventHubs;

using Azure.ResourceManager;
using Azure.ResourceManager.EventHubs;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListEventHubNamespacesTool : OboEnabledBaseService
{
    public ListEventHubNamespacesTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListEventHubNamespacesTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListEventHubNamespacesResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var namespaces = new List<EventHubNamespaceSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var ns in rg.GetEventHubsNamespaces().GetAllAsync(ct))
                {
                    namespaces.Add(MapNamespace(ns));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var ns in sub.GetEventHubsNamespacesAsync(ct))
                {
                    namespaces.Add(MapNamespace(ns));
                }
            }

            return new ListEventHubNamespacesResult { Namespaces = namespaces, Count = namespaces.Count };
        }, "ListEventHubNamespaces", ct);
    }

    private static EventHubNamespaceSummary MapNamespace(EventHubsNamespaceResource ns) => new()
    {
        Id = ns.Id.ToString(),
        Name = ns.Data.Name,
        Location = ns.Data.Location?.Name ?? "",
        Sku = ns.Data.Sku?.Name.ToString() ?? "",
        ServiceBusEndpoint = ns.Data.ServiceBusEndpoint ?? ""
    };
}

public record ListEventHubNamespacesResult
{
    public required List<EventHubNamespaceSummary> Namespaces { get; init; }
    public int Count { get; init; }
}

public record EventHubNamespaceSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string Sku { get; init; }
    public required string ServiceBusEndpoint { get; init; }
}
