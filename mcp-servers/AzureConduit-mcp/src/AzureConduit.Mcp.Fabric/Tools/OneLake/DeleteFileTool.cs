namespace AzureConduit.Mcp.Fabric.Tools.OneLake;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;

/// <summary>
/// Delete a file from OneLake storage
/// </summary>
public class DeleteFileTool : OneLakeBaseService
{
    public DeleteFileTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<DeleteFileTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<DeleteFileResult> ExecuteAsync(string workspaceName, string itemName, string filePath, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateOneLakeClientAsync(ct);

            var path = BuildOneLakePath(workspaceName, itemName, filePath);
            var response = await client.DeleteAsync(path, ct);
            response.EnsureSuccessStatusCode();

            return new DeleteFileResult
            {
                WorkspaceName = workspaceName,
                ItemName = itemName,
                FilePath = filePath,
                Success = true
            };
        }, "DeleteFile", ct);
    }
}

public record DeleteFileResult
{
    public required string WorkspaceName { get; init; }
    public required string ItemName { get; init; }
    public required string FilePath { get; init; }
    public bool Success { get; init; }
}
