namespace AzureConduit.Mcp.Fabric.Tools.OneLake;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;

/// <summary>
/// Create a directory in OneLake via DFS endpoint
/// </summary>
public class CreateDirectoryTool : OneLakeBaseService
{
    public CreateDirectoryTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<CreateDirectoryTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<CreateDirectoryResult> ExecuteAsync(string workspaceName, string itemName, string directoryPath, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateOneLakeClientAsync(ct);

            var path = BuildOneLakePath(workspaceName, itemName, directoryPath);
            var url = $"{path}?resource=directory";

            var response = await client.PutAsync(url, null, ct);
            response.EnsureSuccessStatusCode();

            return new CreateDirectoryResult
            {
                WorkspaceName = workspaceName,
                ItemName = itemName,
                DirectoryPath = directoryPath,
                Success = true
            };
        }, "CreateDirectory", ct);
    }
}

public record CreateDirectoryResult
{
    public required string WorkspaceName { get; init; }
    public required string ItemName { get; init; }
    public required string DirectoryPath { get; init; }
    public bool Success { get; init; }
}
