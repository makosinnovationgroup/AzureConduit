namespace AzureConduit.Mcp.Azure.Tools.ContainerApps;

using Azure.ResourceManager;
using Azure.ResourceManager.AppContainers;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListContainerAppEnvironmentsTool : OboEnabledBaseService
{
    public ListContainerAppEnvironmentsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListContainerAppEnvironmentsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListContainerAppEnvironmentsResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var environments = new List<ContainerAppEnvironmentSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var env in rg.GetContainerAppManagedEnvironments().GetAllAsync(ct))
                {
                    environments.Add(MapEnvironment(env));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var env in sub.GetContainerAppManagedEnvironmentsAsync(ct))
                {
                    environments.Add(MapEnvironment(env));
                }
            }

            return new ListContainerAppEnvironmentsResult { Environments = environments, Count = environments.Count };
        }, "ListContainerAppEnvironments", ct);
    }

    private static ContainerAppEnvironmentSummary MapEnvironment(ContainerAppManagedEnvironmentResource env) => new()
    {
        Id = env.Id.ToString(),
        Name = env.Data.Name,
        Location = env.Data.Location?.Name ?? "",
        ProvisioningState = env.Data.ProvisioningState?.ToString() ?? "",
        DefaultDomain = env.Data.DefaultDomain ?? "",
        StaticIP = env.Data.StaticIP?.ToString() ?? ""
    };
}

public record ListContainerAppEnvironmentsResult
{
    public required List<ContainerAppEnvironmentSummary> Environments { get; init; }
    public int Count { get; init; }
}

public record ContainerAppEnvironmentSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string ProvisioningState { get; init; }
    public required string DefaultDomain { get; init; }
    public required string StaticIP { get; init; }
}
