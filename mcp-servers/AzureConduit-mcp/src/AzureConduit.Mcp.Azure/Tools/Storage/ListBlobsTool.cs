namespace AzureConduit.Mcp.Azure.Tools.Storage;

using Azure.Core;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

/// <summary>
/// Lists blobs in a storage container.
/// Uses the user's OBO token for data plane access.
/// </summary>
public class ListBlobsTool : OboEnabledBaseService
{
    public ListBlobsTool(
        IOboTokenCredentialProvider credentialProvider,
        ILogger<ListBlobsTool> logger)
        : base(credentialProvider, logger)
    {
    }

    public async Task<ListBlobsResult> ExecuteAsync(
        string subscriptionId,
        string resourceGroupName,
        string storageAccountName,
        string containerName,
        string? prefix = null,
        int maxResults = 100,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(storageAccountName))
            throw new ArgumentException("Storage account name is required", nameof(storageAccountName));
        if (string.IsNullOrWhiteSpace(containerName))
            throw new ArgumentException("Container name is required", nameof(containerName));

        return await ExecuteAsync(async () =>
        {
            // Use OBO credential for data plane access
            var credential = GetUserCredential();
            var blobServiceUri = new Uri($"https://{storageAccountName}.blob.core.windows.net");
            var blobServiceClient = new BlobServiceClient(blobServiceUri, credential);
            var containerClient = blobServiceClient.GetBlobContainerClient(containerName);

            var blobs = new List<BlobInfo>();
            var count = 0;

            await foreach (var blobItem in containerClient.GetBlobsAsync(
                prefix: prefix,
                cancellationToken: cancellationToken))
            {
                blobs.Add(new BlobInfo
                {
                    Name = blobItem.Name,
                    ContentType = blobItem.Properties.ContentType,
                    ContentLength = blobItem.Properties.ContentLength,
                    LastModified = blobItem.Properties.LastModified?.DateTime,
                    BlobType = blobItem.Properties.BlobType?.ToString(),
                    AccessTier = blobItem.Properties.AccessTier?.ToString(),
                    IsDeleted = blobItem.Deleted
                });

                count++;
                if (count >= maxResults) break;
            }

            Logger.LogInformation(
                "Listed {Count} blobs in container {Container}",
                blobs.Count,
                containerName);

            return new ListBlobsResult
            {
                StorageAccountName = storageAccountName,
                ContainerName = containerName,
                Prefix = prefix,
                Blobs = blobs,
                Count = blobs.Count,
                Truncated = count >= maxResults
            };
        }, "ListBlobs", cancellationToken);
    }
}

public record ListBlobsResult
{
    public required string StorageAccountName { get; init; }
    public required string ContainerName { get; init; }
    public string? Prefix { get; init; }
    public required List<BlobInfo> Blobs { get; init; }
    public int Count { get; init; }
    public bool Truncated { get; init; }
}

public record BlobInfo
{
    public required string Name { get; init; }
    public string? ContentType { get; init; }
    public long? ContentLength { get; init; }
    public DateTime? LastModified { get; init; }
    public string? BlobType { get; init; }
    public string? AccessTier { get; init; }
    public bool? IsDeleted { get; init; }
}
