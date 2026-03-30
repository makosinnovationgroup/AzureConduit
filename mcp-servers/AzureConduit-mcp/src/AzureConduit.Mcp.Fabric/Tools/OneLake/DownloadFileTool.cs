namespace AzureConduit.Mcp.Fabric.Tools.OneLake;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;

/// <summary>
/// Download a file from OneLake storage
/// </summary>
public class DownloadFileTool : OneLakeBaseService
{
    public DownloadFileTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<DownloadFileTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<DownloadFileResult> ExecuteAsync(string workspaceName, string itemName, string filePath, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateOneLakeClientAsync(ct);

            var path = BuildOneLakePath(workspaceName, itemName, filePath);
            var response = await client.GetAsync(path, ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var contentLength = response.Content.Headers.ContentLength ?? content.Length;

            return new DownloadFileResult
            {
                WorkspaceName = workspaceName,
                ItemName = itemName,
                FilePath = filePath,
                Content = content,
                ContentLength = contentLength,
                Success = true
            };
        }, "DownloadFile", ct);
    }
}

public record DownloadFileResult
{
    public required string WorkspaceName { get; init; }
    public required string ItemName { get; init; }
    public required string FilePath { get; init; }
    public required string Content { get; init; }
    public long ContentLength { get; init; }
    public bool Success { get; init; }
}
