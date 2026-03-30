namespace AzureConduit.Mcp.Azure.Tools.ServiceBus;

using Azure.ResourceManager;
using Azure.ResourceManager.ServiceBus;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListServiceBusNamespacesTool : OboEnabledBaseService
{
    public ListServiceBusNamespacesTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListServiceBusNamespacesTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListServiceBusNamespacesResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var namespaces = new List<ServiceBusNamespaceSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var ns in rg.GetServiceBusNamespaces().GetAllAsync(ct))
                {
                    namespaces.Add(MapNamespace(ns));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var ns in sub.GetServiceBusNamespacesAsync(ct))
                {
                    namespaces.Add(MapNamespace(ns));
                }
            }

            return new ListServiceBusNamespacesResult { Namespaces = namespaces, Count = namespaces.Count };
        }, "ListServiceBusNamespaces", ct);
    }

    private static ServiceBusNamespaceSummary MapNamespace(ServiceBusNamespaceResource ns) => new()
    {
        Id = ns.Id.ToString(),
        Name = ns.Data.Name,
        Location = ns.Data.Location?.Name ?? "",
        Sku = ns.Data.Sku?.Name.ToString() ?? "",
        ServiceBusEndpoint = ns.Data.ServiceBusEndpoint ?? ""
    };
}

public record ListServiceBusNamespacesResult
{
    public required List<ServiceBusNamespaceSummary> Namespaces { get; init; }
    public int Count { get; init; }
}

public record ServiceBusNamespaceSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string Sku { get; init; }
    public required string ServiceBusEndpoint { get; init; }
}
