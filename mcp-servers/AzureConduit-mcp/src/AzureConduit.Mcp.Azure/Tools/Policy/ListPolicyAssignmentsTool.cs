namespace AzureConduit.Mcp.Azure.Tools.Policy;

using Azure.ResourceManager;
using Azure.ResourceManager.Resources;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class ListPolicyAssignmentsTool : OboEnabledBaseService
{
    public ListPolicyAssignmentsTool(IOboTokenCredentialProvider credentialProvider, ILogger<ListPolicyAssignmentsTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<ListPolicyAssignmentsResult> ExecuteAsync(string subscriptionId, string? resourceGroup = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var assignments = new List<PolicyAssignmentSummary>();

            if (!string.IsNullOrEmpty(resourceGroup))
            {
                var rg = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"))
                    .GetResourceGroup(resourceGroup).Value;
                await foreach (var assignment in rg.GetPolicyAssignments().GetAllAsync(ct: ct))
                {
                    assignments.Add(MapAssignment(assignment));
                }
            }
            else
            {
                var sub = client.GetSubscriptionResource(new Azure.Core.ResourceIdentifier($"/subscriptions/{subscriptionId}"));
                await foreach (var assignment in sub.GetPolicyAssignments().GetAllAsync(ct: ct))
                {
                    assignments.Add(MapAssignment(assignment));
                }
            }

            return new ListPolicyAssignmentsResult { Assignments = assignments, Count = assignments.Count };
        }, "ListPolicyAssignments", ct);
    }

    private static PolicyAssignmentSummary MapAssignment(PolicyAssignmentResource assignment) => new()
    {
        Id = assignment.Id.ToString(),
        Name = assignment.Data.Name,
        DisplayName = assignment.Data.DisplayName ?? "",
        PolicyDefinitionId = assignment.Data.PolicyDefinitionId ?? "",
        Scope = assignment.Data.Scope ?? "",
        EnforcementMode = assignment.Data.EnforcementMode?.ToString() ?? ""
    };
}

public record ListPolicyAssignmentsResult
{
    public required List<PolicyAssignmentSummary> Assignments { get; init; }
    public int Count { get; init; }
}

public record PolicyAssignmentSummary
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string DisplayName { get; init; }
    public required string PolicyDefinitionId { get; init; }
    public required string Scope { get; init; }
    public required string EnforcementMode { get; init; }
}
