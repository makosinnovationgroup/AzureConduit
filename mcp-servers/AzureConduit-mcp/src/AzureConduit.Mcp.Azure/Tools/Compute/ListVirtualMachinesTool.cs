namespace AzureConduit.Mcp.Azure.Tools.Compute;

using Azure.ResourceManager.Compute;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Lists all virtual machines in a subscription that the user has access to.
/// </summary>
public class ListVirtualMachinesTool : OboEnabledBaseService
{
    public ListVirtualMachinesTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListVirtualMachinesTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListVirtualMachinesResult> ExecuteAsync(
        string subscriptionId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);
            var vms = new List<VirtualMachineInfo>();

            await foreach (var vm in subscription.GetVirtualMachinesAsync(cancellationToken: cancellationToken))
            {
                vms.Add(new VirtualMachineInfo
                {
                    Id = vm.Data.Id.ToString(),
                    Name = vm.Data.Name,
                    ResourceGroup = ExtractResourceGroup(vm.Data.Id.ToString()),
                    Location = vm.Data.Location.Name,
                    VmSize = vm.Data.HardwareProfile?.VmSize?.ToString(),
                    OsType = vm.Data.StorageProfile?.OSDisk?.OSType?.ToString(),
                    ProvisioningState = vm.Data.ProvisioningState,
                    ComputerName = vm.Data.OSProfile?.ComputerName,
                    AdminUsername = vm.Data.OSProfile?.AdminUsername,
                    Tags = vm.Data.Tags?.ToDictionary(t => t.Key, t => t.Value)
                });
            }

            Logger.LogInformation(
                "Listed {Count} VMs in subscription {SubscriptionId}",
                vms.Count,
                subscriptionId);

            return new ListVirtualMachinesResult
            {
                SubscriptionId = subscriptionId,
                VirtualMachines = vms,
                Count = vms.Count
            };
        }, "ListVirtualMachines", cancellationToken);
    }

    private static string? ExtractResourceGroup(string resourceId)
    {
        var parts = resourceId.Split('/');
        for (int i = 0; i < parts.Length - 1; i++)
        {
            if (parts[i].Equals("resourceGroups", StringComparison.OrdinalIgnoreCase))
            {
                return parts[i + 1];
            }
        }
        return null;
    }
}

public record ListVirtualMachinesResult
{
    public required string SubscriptionId { get; init; }
    public required List<VirtualMachineInfo> VirtualMachines { get; init; }
    public int Count { get; init; }
}

public record VirtualMachineInfo
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? ResourceGroup { get; init; }
    public required string Location { get; init; }
    public string? VmSize { get; init; }
    public string? OsType { get; init; }
    public string? ProvisioningState { get; init; }
    public string? ComputerName { get; init; }
    public string? AdminUsername { get; init; }
    public Dictionary<string, string>? Tags { get; init; }
}
