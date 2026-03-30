namespace AzureConduit.Mcp.Azure.Tools.Sql;

using Azure.ResourceManager;
using Azure.ResourceManager.Sql;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListSqlServersTool : OboEnabledBaseService
{
    public ListSqlServersTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListSqlServersTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListSqlServersResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var servers = new List<SqlServerSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var server in rg.GetSqlServers().GetAllAsync(ct))
                {
                    servers.Add(MapServer(server));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var server in sub.GetSqlServersAsync(ct))
                {
                    servers.Add(MapServer(server));
                }
            }

            return new ListSqlServersResult { Servers = servers, Count = servers.Count };
        }, "ListSqlServers", ct);
    }

    private static SqlServerSummary MapServer(SqlServerResource server) => new()
    {
        Id = server.Id.ToString(),
        Name = server.Data.Name,
        Location = server.Data.Location?.Name ?? "",
        FullyQualifiedDomainName = server.Data.FullyQualifiedDomainName ?? "",
        State = server.Data.State ?? ""
    };
}

public record ListSqlServersResult
{
    public required List<SqlServerSummary> Servers { get; init; }
    public int Count { get; init; }
}

public record SqlServerSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string FullyQualifiedDomainName { get; init; }
    public required string State { get; init; }
}
