namespace AzureConduit.Mcp.Azure.Tools.Compute;

using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Stops (deallocates) a virtual machine.
/// Requires Contributor or VM Contributor role on the VM.
/// </summary>
public class StopVirtualMachineTool : OboEnabledBaseService
{
    public StopVirtualMachineTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<StopVirtualMachineTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<VmOperationResult> ExecuteAsync(
        string subscriptionId,
        string resourceGroupName,
        string vmName,
        bool deallocate = true,
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

            var vm = await rg.Value.GetVirtualMachines()
                .GetAsync(vmName, cancellationToken: cancellationToken);

            if (deallocate)
            {
                // Deallocate stops the VM and releases compute resources (no charges)
                await vm.Value.DeallocateAsync(Azure.WaitUntil.Completed, cancellationToken: cancellationToken);
            }
            else
            {
                // PowerOff stops the VM but keeps it allocated (still charges)
                await vm.Value.PowerOffAsync(Azure.WaitUntil.Completed, cancellationToken: cancellationToken);
            }

            var operation = deallocate ? "Deallocate" : "PowerOff";

            Logger.LogInformation(
                "{Operation} VM {VmName} in resource group {ResourceGroup}",
                operation,
                vmName,
                resourceGroupName);

            return new VmOperationResult
            {
                VmName = vmName,
                ResourceGroup = resourceGroupName,
                Operation = operation,
                Status = "Succeeded",
                Message = deallocate
                    ? $"Virtual machine '{vmName}' has been deallocated (stopped and resources released)."
                    : $"Virtual machine '{vmName}' has been powered off (still allocated)."
            };
        }, "StopVirtualMachine", cancellationToken);
    }
}
