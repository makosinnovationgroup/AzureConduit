namespace AzureConduit.Mcp.Azure.Tools.ServiceBus;

using Azure.ResourceManager;
using Azure.ResourceManager.ServiceBus;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListServiceBusQueuesTool : OboEnabledBaseService
{
    public ListServiceBusQueuesTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListServiceBusQueuesTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListServiceBusQueuesResult> ExecuteAsync(string subscriptionId, string resourceGroup, string namespaceName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var ns = client.GetServiceBusNamespaceResource(
                ServiceBusNamespaceResource.CreateResourceIdentifier(subscriptionId, resourceGroup, namespaceName));

            var queues = new List<ServiceBusQueueSummary>();
            await foreach (var queue in ns.GetServiceBusQueues().GetAllAsync(ct))
            {
                queues.Add(new ServiceBusQueueSummary
                {
                    Id = queue.Id.ToString(),
                    Name = queue.Data.Name,
                    MessageCount = queue.Data.MessageCount ?? 0,
                    SizeInBytes = queue.Data.SizeInBytes ?? 0,
                    Status = queue.Data.Status?.ToString() ?? ""
                });
            }

            return new ListServiceBusQueuesResult { Queues = queues, Count = queues.Count };
        }, "ListServiceBusQueues", ct);
    }
}

public record ListServiceBusQueuesResult
{
    public required List<ServiceBusQueueSummary> Queues { get; init; }
    public int Count { get; init; }
}

public record ServiceBusQueueSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public long MessageCount { get; init; }
    public long SizeInBytes { get; init; }
    public required string Status { get; init; }
}
