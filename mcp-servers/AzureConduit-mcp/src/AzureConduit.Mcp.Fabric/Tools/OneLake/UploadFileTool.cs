namespace AzureConduit.Mcp.Fabric.Tools.OneLake;

using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;

/// <summary>
/// Upload a file to OneLake storage
/// </summary>
public class UploadFileTool : OneLakeBaseService
{
    public UploadFileTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<UploadFileTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<UploadFileResult> ExecuteAsync(string workspaceName, string itemName, string filePath, string content, bool overwrite = false, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateOneLakeClientAsync(ct);

            var path = BuildOneLakePath(workspaceName, itemName, filePath);

            // Step 1: Create the file
            var createUrl = $"{path}?resource=file";
            var createResponse = await client.PutAsync(createUrl, null, ct);
            createResponse.EnsureSuccessStatusCode();

            // Step 2: Append content
            var contentBytes = Encoding.UTF8.GetBytes(content);
            var appendUrl = $"{path}?action=append&position=0";
            var appendContent = new ByteArrayContent(contentBytes);
            var appendResponse = await client.PatchAsync(appendUrl, appendContent, ct);
            appendResponse.EnsureSuccessStatusCode();

            // Step 3: Flush to finalize
            var flushUrl = $"{path}?action=flush&position={contentBytes.Length}";
            var flushResponse = await client.PatchAsync(flushUrl, null, ct);
            flushResponse.EnsureSuccessStatusCode();

            return new UploadFileResult
            {
                WorkspaceName = workspaceName,
                ItemName = itemName,
                FilePath = filePath,
                BytesWritten = contentBytes.Length,
                Success = true
            };
        }, "UploadFile", ct);
    }
}

public record UploadFileResult
{
    public required string WorkspaceName { get; init; }
    public required string ItemName { get; init; }
    public required string FilePath { get; init; }
    public int BytesWritten { get; init; }
    public bool Success { get; init; }
}
