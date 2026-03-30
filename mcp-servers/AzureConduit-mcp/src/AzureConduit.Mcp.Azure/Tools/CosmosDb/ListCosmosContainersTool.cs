namespace AzureConduit.Mcp.Azure.Tools.CosmosDb;

using Azure.ResourceManager;
using Azure.ResourceManager.CosmosDB;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListCosmosContainersTool : OboEnabledBaseService
{
    public ListCosmosContainersTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListCosmosContainersTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListCosmosContainersResult> ExecuteAsync(string subscriptionId, string resourceGroup, string accountName, string databaseName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var database = client.GetCosmosDBSqlDatabaseResource(
                CosmosDBSqlDatabaseResource.CreateResourceIdentifier(subscriptionId, resourceGroup, accountName, databaseName));

            var containers = new List<CosmosContainerSummary>();
            await foreach (var container in database.GetCosmosDBSqlContainers().GetAllAsync(ct))
            {
                containers.Add(new CosmosContainerSummary
                {
                    Id = container.Id.ToString(),
                    Name = container.Data.Name,
                    PartitionKeyPath = container.Data.Resource?.PartitionKey?.Paths?.FirstOrDefault() ?? ""
                });
            }

            return new ListCosmosContainersResult { Containers = containers, Count = containers.Count };
        }, "ListCosmosContainers", ct);
    }
}

public record ListCosmosContainersResult
{
    public required List<CosmosContainerSummary> Containers { get; init; }
    public int Count { get; init; }
}

public record CosmosContainerSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string PartitionKeyPath { get; init; }
}
