namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class GetPipelineTool : FabricBaseService
{
    public GetPipelineTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetPipelineTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<PipelineDetails> ExecuteAsync(string workspaceId, string pipelineId, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var response = await client.GetAsync($"/workspaces/{workspaceId}/dataPipelines/{pipelineId}", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<PipelineDetails>(content, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize pipeline");
        }, "GetPipeline", ct);
    }
}

public record PipelineDetails
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public string? Description { get; init; }
    public string? WorkspaceId { get; init; }
}
