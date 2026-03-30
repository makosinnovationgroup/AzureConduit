namespace AzureConduit.Mcp.Azure.Tools.ContainerRegistry;

using Azure.ResourceManager;
using Azure.ResourceManager.ContainerRegistry;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListContainerRegistriesTool : OboEnabledBaseService
{
    public ListContainerRegistriesTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListContainerRegistriesTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListContainerRegistriesResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var registries = new List<ContainerRegistrySummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var registry in rg.GetContainerRegistries().GetAllAsync(ct))
                {
                    registries.Add(MapRegistry(registry));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var registry in sub.GetContainerRegistriesAsync(ct))
                {
                    registries.Add(MapRegistry(registry));
                }
            }

            return new ListContainerRegistriesResult { Registries = registries, Count = registries.Count };
        }, "ListContainerRegistries", ct);
    }

    private static ContainerRegistrySummary MapRegistry(ContainerRegistryResource registry) => new()
    {
        Id = registry.Id.ToString(),
        Name = registry.Data.Name,
        Location = registry.Data.Location?.Name ?? "",
        LoginServer = registry.Data.LoginServer ?? "",
        Sku = registry.Data.Sku?.Name.ToString() ?? "",
        ProvisioningState = registry.Data.ProvisioningState?.ToString() ?? ""
    };
}

public record ListContainerRegistriesResult
{
    public required List<ContainerRegistrySummary> Registries { get; init; }
    public int Count { get; init; }
}

public record ContainerRegistrySummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string LoginServer { get; init; }
    public required string Sku { get; init; }
    public required string ProvisioningState { get; init; }
}
