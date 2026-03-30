namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class RunPipelineTool : FabricBaseService
{
    public RunPipelineTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<RunPipelineTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<PipelineRunResult> ExecuteAsync(string workspaceId, string pipelineId, Dictionary<string, object>? parameters = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);

            var payload = new Dictionary<string, object>();
            if (parameters != null && parameters.Count > 0)
            {
                payload["executionData"] = new { parameters };
            }

            var json = JsonSerializer.Serialize(payload, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"/workspaces/{workspaceId}/items/{pipelineId}/jobs/instances?jobType=Pipeline", content, ct);
            response.EnsureSuccessStatusCode();

            // Get the job instance ID from response headers or body
            var responseContent = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<PipelineRunResponse>(responseContent, JsonOptions);

            return new PipelineRunResult
            {
                PipelineId = pipelineId,
                RunId = result?.Id ?? "",
                Status = "Started"
            };
        }, "RunPipeline", ct);
    }
}

public record PipelineRunResponse
{
    public string? Id { get; init; }
}

public record PipelineRunResult
{
    public required string PipelineId { get; init; }
    public required string RunId { get; init; }
    public required string Status { get; init; }
}
