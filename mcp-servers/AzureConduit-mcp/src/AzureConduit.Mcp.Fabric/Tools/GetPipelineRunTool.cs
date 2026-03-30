namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class GetPipelineRunTool : FabricBaseService
{
    public GetPipelineRunTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetPipelineRunTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<PipelineRunDetails> ExecuteAsync(string workspaceId, string pipelineId, string runId, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var response = await client.GetAsync($"/workspaces/{workspaceId}/items/{pipelineId}/jobs/instances/{runId}", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<PipelineRunDetails>(content, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize pipeline run");
        }, "GetPipelineRun", ct);
    }
}

public record PipelineRunDetails
{
    public required string Id { get; init; }
    public string? ItemId { get; init; }
    public string? JobType { get; init; }
    public string? InvokeType { get; init; }
    public string? Status { get; init; }
    public string? StartTimeUtc { get; init; }
    public string? EndTimeUtc { get; init; }
    public FailureReason? FailureReason { get; init; }
}

public record FailureReason
{
    public string? Message { get; init; }
    public string? ErrorCode { get; init; }
}
