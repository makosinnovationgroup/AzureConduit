namespace AzureConduit.Mcp.Azure.Tools.Sql;

using Azure.ResourceManager;
using Azure.ResourceManager.Sql;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListSqlDatabasesTool : OboEnabledBaseService
{
    public ListSqlDatabasesTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListSqlDatabasesTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListSqlDatabasesResult> ExecuteAsync(string subscriptionId, string resourceGroup, string serverName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var server = client.GetSqlServerResource(
                SqlServerResource.CreateResourceIdentifier(subscriptionId, resourceGroup, serverName));

            var databases = new List<SqlDatabaseSummary>();
            await foreach (var db in server.GetSqlDatabases().GetAllAsync(ct))
            {
                databases.Add(new SqlDatabaseSummary
                {
                    Id = db.Id.ToString(),
                    Name = db.Data.Name,
                    Status = db.Data.Status?.ToString() ?? "",
                    Sku = db.Data.Sku?.Name ?? "",
                    MaxSizeBytes = db.Data.MaxSizeBytes ?? 0
                });
            }

            return new ListSqlDatabasesResult { Databases = databases, Count = databases.Count };
        }, "ListSqlDatabases", ct);
    }
}

public record ListSqlDatabasesResult
{
    public required List<SqlDatabaseSummary> Databases { get; init; }
    public int Count { get; init; }
}

public record SqlDatabaseSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Status { get; init; }
    public required string Sku { get; init; }
    public long MaxSizeBytes { get; init; }
}
