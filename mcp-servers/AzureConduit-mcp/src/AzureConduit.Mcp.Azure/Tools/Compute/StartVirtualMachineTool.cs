namespace AzureConduit.Mcp.Azure.Tools.Compute;

using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Starts a virtual machine.
/// Requires Contributor or VM Contributor role on the VM.
/// </summary>
public class StartVirtualMachineTool : OboEnabledBaseService
{
    public StartVirtualMachineTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<StartVirtualMachineTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<VmOperationResult> ExecuteAsync(
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

            var vm = await rg.Value.GetVirtualMachines()
                .GetAsync(vmName, cancellationToken: cancellationToken);

            await vm.Value.PowerOnAsync(Azure.WaitUntil.Completed, cancellationToken);

            Logger.LogInformation(
                "Started VM {VmName} in resource group {ResourceGroup}",
                vmName,
                resourceGroupName);

            return new VmOperationResult
            {
                VmName = vmName,
                ResourceGroup = resourceGroupName,
                Operation = "Start",
                Status = "Succeeded",
                Message = $"Virtual machine '{vmName}' has been started."
            };
        }, "StartVirtualMachine", cancellationToken);
    }
}

public record VmOperationResult
{
    public required string VmName { get; init; }
    public required string ResourceGroup { get; init; }
    public required string Operation { get; init; }
    public required string Status { get; init; }
    public string? Message { get; init; }
}
