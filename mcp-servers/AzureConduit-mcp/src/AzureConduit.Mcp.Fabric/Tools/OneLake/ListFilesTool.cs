namespace AzureConduit.Mcp.Fabric.Tools.OneLake;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;

/// <summary>
/// List files in OneLake using hierarchical file-list endpoint
/// </summary>
public class ListFilesTool : OneLakeBaseService
{
    public ListFilesTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<ListFilesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<ListFilesResult> ExecuteAsync(string workspaceName, string itemName, string? directory = null, bool recursive = false, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateOneLakeClientAsync(ct);

            var path = BuildOneLakePath(workspaceName, itemName, directory);
            var url = $"{path}?resource=filesystem&recursive={recursive.ToString().ToLower()}";

            var response = await client.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<DfsListResponse>(content, JsonOptions);

            var files = result?.Paths?.Select(p => new OneLakeFile
            {
                Name = p.Name ?? "",
                IsDirectory = p.IsDirectory == "true",
                ContentLength = long.TryParse(p.ContentLength, out var len) ? len : 0,
                LastModified = p.LastModified
            }).ToList() ?? new();

            return new ListFilesResult
            {
                WorkspaceName = workspaceName,
                ItemName = itemName,
                Directory = directory,
                Files = files,
                Count = files.Count
            };
        }, "ListFiles", ct);
    }
}

internal record DfsListResponse
{
    public List<DfsPath>? Paths { get; init; }
}

internal record DfsPath
{
    public string? Name { get; init; }
    public string? IsDirectory { get; init; }
    public string? ContentLength { get; init; }
    public string? LastModified { get; init; }
}

public record ListFilesResult
{
    public required string WorkspaceName { get; init; }
    public required string ItemName { get; init; }
    public string? Directory { get; init; }
    public required List<OneLakeFile> Files { get; init; }
    public int Count { get; init; }
}

public record OneLakeFile
{
    public required string Name { get; init; }
    public bool IsDirectory { get; init; }
    public long ContentLength { get; init; }
    public string? LastModified { get; init; }
}
