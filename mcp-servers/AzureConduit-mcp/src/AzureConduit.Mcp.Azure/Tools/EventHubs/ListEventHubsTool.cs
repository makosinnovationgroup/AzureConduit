namespace AzureConduit.Mcp.Azure.Tools.EventHubs;

using Azure.ResourceManager;
using Azure.ResourceManager.EventHubs;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListEventHubsTool : OboEnabledBaseService
{
    public ListEventHubsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListEventHubsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListEventHubsResult> ExecuteAsync(string subscriptionId, string resourceGroup, string namespaceName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var ns = client.GetEventHubsNamespaceResource(
                EventHubsNamespaceResource.CreateResourceIdentifier(subscriptionId, resourceGroup, namespaceName));

            var hubs = new List<EventHubSummary>();
            await foreach (var hub in ns.GetEventHubs().GetAllAsync(ct))
            {
                hubs.Add(new EventHubSummary
                {
                    Id = hub.Id.ToString(),
                    Name = hub.Data.Name,
                    PartitionCount = hub.Data.PartitionCount ?? 0,
                    MessageRetentionInDays = hub.Data.MessageRetentionInDays ?? 0
                });
            }

            return new ListEventHubsResult { EventHubs = hubs, Count = hubs.Count };
        }, "ListEventHubs", ct);
    }
}

public record ListEventHubsResult
{
    public required List<EventHubSummary> EventHubs { get; init; }
    public int Count { get; init; }
}

public record EventHubSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public int PartitionCount { get; init; }
    public long MessageRetentionInDays { get; init; }
}
