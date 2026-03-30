namespace AzureConduit.Mcp.Azure.Tools.ServiceBus;

using Azure.ResourceManager;
using Azure.ResourceManager.ServiceBus;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListServiceBusTopicsTool : OboEnabledBaseService
{
    public ListServiceBusTopicsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListServiceBusTopicsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListServiceBusTopicsResult> ExecuteAsync(string subscriptionId, string resourceGroup, string namespaceName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var ns = client.GetServiceBusNamespaceResource(
                ServiceBusNamespaceResource.CreateResourceIdentifier(subscriptionId, resourceGroup, namespaceName));

            var topics = new List<ServiceBusTopicSummary>();
            await foreach (var topic in ns.GetServiceBusTopics().GetAllAsync(ct))
            {
                topics.Add(new ServiceBusTopicSummary
                {
                    Id = topic.Id.ToString(),
                    Name = topic.Data.Name,
                    SubscriptionCount = topic.Data.SubscriptionCount ?? 0,
                    SizeInBytes = topic.Data.SizeInBytes ?? 0,
                    Status = topic.Data.Status?.ToString() ?? ""
                });
            }

            return new ListServiceBusTopicsResult { Topics = topics, Count = topics.Count };
        }, "ListServiceBusTopics", ct);
    }
}

public record ListServiceBusTopicsResult
{
    public required List<ServiceBusTopicSummary> Topics { get; init; }
    public int Count { get; init; }
}

public record ServiceBusTopicSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public int SubscriptionCount { get; init; }
    public long SizeInBytes { get; init; }
    public required string Status { get; init; }
}
