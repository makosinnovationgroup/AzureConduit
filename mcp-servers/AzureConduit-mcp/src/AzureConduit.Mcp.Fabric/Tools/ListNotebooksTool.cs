namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class ListNotebooksTool : FabricBaseService
{
    public ListNotebooksTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListNotebooksTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ListNotebooksResult> ExecuteAsync(string workspaceId, string? continuationToken = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);
            var url = $"/workspaces/{workspaceId}/notebooks";
            if (!string.IsNullOrEmpty(continuationToken))
                url += $"?continuationToken={Uri.EscapeDataString(continuationToken)}";

            var response = await client.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<ODataResponse<NotebookSummary>>(content, JsonOptions);

            return new ListNotebooksResult
            {
                Notebooks = result?.Value ?? new(),
                ContinuationToken = result?.ContinuationToken
            };
        }, "ListNotebooks", ct);
    }
}

public record ListNotebooksResult
{
    public required List<NotebookSummary> Notebooks { get; init; }
    public string? ContinuationToken { get; init; }
}

public record NotebookSummary
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public string? Description { get; init; }
    public string? WorkspaceId { get; init; }
}
