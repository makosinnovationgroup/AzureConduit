namespace AzureConduit.Mcp.Azure.Tools.CosmosDb;

using Azure.ResourceManager;
using Azure.ResourceManager.CosmosDB;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListCosmosAccountsTool : OboEnabledBaseService
{
    public ListCosmosAccountsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListCosmosAccountsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListCosmosAccountsResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var accounts = new List<CosmosAccountSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var account in rg.GetCosmosDBAccounts().GetAllAsync(ct))
                {
                    accounts.Add(MapAccount(account));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var account in sub.GetCosmosDBAccountsAsync(ct))
                {
                    accounts.Add(MapAccount(account));
                }
            }

            return new ListCosmosAccountsResult { Accounts = accounts, Count = accounts.Count };
        }, "ListCosmosAccounts", ct);
    }

    private static CosmosAccountSummary MapAccount(CosmosDBAccountResource account) => new()
    {
        Id = account.Id.ToString(),
        Name = account.Data.Name,
        Location = account.Data.Location?.Name ?? "",
        Kind = account.Data.Kind?.ToString() ?? "",
        DocumentEndpoint = account.Data.DocumentEndpoint?.ToString() ?? ""
    };
}

public record ListCosmosAccountsResult
{
    public required List<CosmosAccountSummary> Accounts { get; init; }
    public int Count { get; init; }
}

public record CosmosAccountSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string Kind { get; init; }
    public required string DocumentEndpoint { get; init; }
}
