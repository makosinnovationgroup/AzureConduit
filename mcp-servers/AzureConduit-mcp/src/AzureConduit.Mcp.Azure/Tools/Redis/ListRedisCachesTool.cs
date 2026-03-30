namespace AzureConduit.Mcp.Azure.Tools.Redis;

using Azure.ResourceManager;
using Azure.ResourceManager.Redis;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListRedisCachesTool : OboEnabledBaseService
{
    public ListRedisCachesTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListRedisCachesTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListRedisCachesResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var caches = new List<RedisCacheSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var cache in rg.GetAllRedis().GetAllAsync(ct))
                {
                    caches.Add(MapCache(cache));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var cache in sub.GetAllRedisAsync(ct))
                {
                    caches.Add(MapCache(cache));
                }
            }

            return new ListRedisCachesResult { Caches = caches, Count = caches.Count };
        }, "ListRedisCaches", ct);
    }

    private static RedisCacheSummary MapCache(RedisResource cache) => new()
    {
        Id = cache.Id.ToString(),
        Name = cache.Data.Name,
        Location = cache.Data.Location?.Name ?? "",
        HostName = cache.Data.HostName ?? "",
        Port = cache.Data.Port ?? 0,
        SslPort = cache.Data.SslPort ?? 0,
        Sku = cache.Data.Sku?.Name.ToString() ?? "",
        ProvisioningState = cache.Data.ProvisioningState?.ToString() ?? ""
    };
}

public record ListRedisCachesResult
{
    public required List<RedisCacheSummary> Caches { get; init; }
    public int Count { get; init; }
}

public record RedisCacheSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string HostName { get; init; }
    public int Port { get; init; }
    public int SslPort { get; init; }
    public required string Sku { get; init; }
    public required string ProvisioningState { get; init; }
}
