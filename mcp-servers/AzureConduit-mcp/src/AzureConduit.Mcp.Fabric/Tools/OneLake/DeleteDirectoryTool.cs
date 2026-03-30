namespace AzureConduit.Mcp.Fabric.Tools.OneLake;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;

/// <summary>
/// Delete a directory from OneLake (optionally recursive)
/// </summary>
public class DeleteDirectoryTool : OneLakeBaseService
{
    public DeleteDirectoryTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<DeleteDirectoryTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<DeleteDirectoryResult> ExecuteAsync(string workspaceName, string itemName, string directoryPath, bool recursive = false, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateOneLakeClientAsync(ct);

            var path = BuildOneLakePath(workspaceName, itemName, directoryPath);
            var url = recursive ? $"{path}?recursive=true" : path;

            var response = await client.DeleteAsync(url, ct);
            response.EnsureSuccessStatusCode();

            return new DeleteDirectoryResult
            {
                WorkspaceName = workspaceName,
                ItemName = itemName,
                DirectoryPath = directoryPath,
                Recursive = recursive,
                Success = true
            };
        }, "DeleteDirectory", ct);
    }
}

public record DeleteDirectoryResult
{
    public required string WorkspaceName { get; init; }
    public required string ItemName { get; init; }
    public required string DirectoryPath { get; init; }
    public bool Recursive { get; init; }
    public bool Success { get; init; }
}
