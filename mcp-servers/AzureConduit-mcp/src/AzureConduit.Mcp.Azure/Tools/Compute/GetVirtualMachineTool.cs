namespace AzureConduit.Mcp.Azure.Tools.Compute;

using Azure.ResourceManager.Compute;
using Azure.ResourceManager.Compute.Models;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Gets detailed information about a specific virtual machine including instance view.
/// </summary>
public class GetVirtualMachineTool : OboEnabledBaseService
{
    public GetVirtualMachineTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<GetVirtualMachineTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<VirtualMachineDetails> ExecuteAsync(
        string subscriptionId,
        string resourceGroupName,
        string vmName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(subscriptionId))
            throw new ArgumentException("Subscription ID is required", nameof(subscriptionId));
        if (string.IsNullOrWhiteSpace(resourceGroupName))
            throw new ArgumentException("Resource group name is required", nameof(resourceGroupName));
        if (string.IsNullOrWhiteSpace(vmName))
            throw new ArgumentException("VM name is required", nameof(vmName));

        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient(subscriptionId);
            var subscription = await client.GetDefaultSubscriptionAsync(cancellationToken);

            var rg = await subscription.GetResourceGroups()
                .GetAsync(resourceGroupName, cancellationToken);

            var vmResponse = await rg.Value.GetVirtualMachines()
                .GetAsync(vmName, InstanceViewType.InstanceView, cancellationToken: cancellationToken);

            var vm = vmResponse.Value;
            var data = vm.Data;
            var instanceView = data.InstanceView;

            Logger.LogInformation(
                "Retrieved VM {VmName} from resource group {ResourceGroup}",
                vmName,
                resourceGroupName);

            return new VirtualMachineDetails
            {
                Id = data.Id.ToString(),
                Name = data.Name,
                ResourceGroup = resourceGroupName,
                Location = data.Location.Name,
                VmSize = data.HardwareProfile?.VmSize?.ToString(),
                OsType = data.StorageProfile?.OSDisk?.OSType?.ToString(),
                ProvisioningState = data.ProvisioningState,
                ComputerName = data.OSProfile?.ComputerName,
                AdminUsername = data.OSProfile?.AdminUsername,
                PowerState = GetPowerState(instanceView),
                OsDisk = data.StorageProfile?.OSDisk is not null ? new OsDiskInfo
                {
                    Name = data.StorageProfile.OSDisk.Name,
                    DiskSizeGB = data.StorageProfile.OSDisk.DiskSizeGB,
                    Caching = data.StorageProfile.OSDisk.Caching?.ToString(),
                    CreateOption = data.StorageProfile.OSDisk.CreateOption?.ToString()
                } : null,
                NetworkInterfaces = data.NetworkProfile?.NetworkInterfaces?
                    .Select(nic => nic.Id.ToString())
                    .ToList(),
                Tags = data.Tags?.ToDictionary(t => t.Key, t => t.Value)
            };
        }, "GetVirtualMachine", cancellationToken);
    }

    private static string? GetPowerState(VirtualMachineInstanceView? instanceView)
    {
        if (instanceView?.Statuses is null) return null;

        foreach (var status in instanceView.Statuses)
        {
            if (status.Code?.StartsWith("PowerState/") == true)
            {
                return status.Code.Replace("PowerState/", "");
            }
        }
        return null;
    }
}

public record VirtualMachineDetails
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string ResourceGroup { get; init; }
    public required string Location { get; init; }
    public string? VmSize { get; init; }
    public string? OsType { get; init; }
    public string? ProvisioningState { get; init; }
    public string? ComputerName { get; init; }
    public string? AdminUsername { get; init; }
    public string? PowerState { get; init; }
    public OsDiskInfo? OsDisk { get; init; }
    public List<string>? NetworkInterfaces { get; init; }
    public Dictionary<string, string>? Tags { get; init; }
}

public record OsDiskInfo
{
    public string? Name { get; init; }
    public int? DiskSizeGB { get; init; }
    public string? Caching { get; init; }
    public string? CreateOption { get; init; }
}
