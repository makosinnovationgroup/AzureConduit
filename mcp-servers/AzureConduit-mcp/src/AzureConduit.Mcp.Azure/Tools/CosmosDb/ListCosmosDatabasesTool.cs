namespace AzureConduit.Mcp.Azure.Tools.CosmosDb;

using Azure.ResourceManager;
using Azure.ResourceManager.CosmosDB;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListCosmosDatabasesTool : OboEnabledBaseService
{
    public ListCosmosDatabasesTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListCosmosDatabasesTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListCosmosDatabasesResult> ExecuteAsync(string subscriptionId, string resourceGroup, string accountName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var account = client.GetCosmosDBAccountResource(
                CosmosDBAccountResource.CreateResourceIdentifier(subscriptionId, resourceGroup, accountName));

            var databases = new List<CosmosDatabaseSummary>();
            await foreach (var db in account.GetCosmosDBSqlDatabases().GetAllAsync(ct))
            {
                databases.Add(new CosmosDatabaseSummary
                {
                    Id = db.Id.ToString(),
                    Name = db.Data.Name,
                    ResourceId = db.Data.Resource?.Id ?? ""
                });
            }

            return new ListCosmosDatabasesResult { Databases = databases, Count = databases.Count };
        }, "ListCosmosDatabases", ct);
    }
}

public record ListCosmosDatabasesResult
{
    public required List<CosmosDatabaseSummary> Databases { get; init; }
    public int Count { get; init; }
}

public record CosmosDatabaseSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string ResourceId { get; init; }
}
