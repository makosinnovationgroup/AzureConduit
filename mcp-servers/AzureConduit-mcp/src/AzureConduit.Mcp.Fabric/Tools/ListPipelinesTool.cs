namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class ListPipelinesTool : FabricBaseService
{
    public ListPipelinesTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListPipelinesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ListPipelinesResult> ExecuteAsync(string workspaceId, string? continuationToken = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var url = $"/workspaces/{workspaceId}/dataPipelines";
            if (!string.IsNullOrEmpty(continuationToken))
                url += $"?continuationToken={Uri.EscapeDataString(continuationToken)}";

            var response = await client.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<ODataResponse<PipelineSummary>>(content, JsonOptions);

            return new ListPipelinesResult
            {
                Pipelines = result?.Value ?? new(),
                ContinuationToken = result?.ContinuationToken
            };
        }, "ListPipelines", ct);
    }
}

public record ListPipelinesResult
{
    public required List<PipelineSummary> Pipelines { get; init; }
    public string? ContinuationToken { get; init; }
}

public record PipelineSummary
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public string? Description { get; init; }
    public string? WorkspaceId { get; init; }
}
