namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class DeleteTableTool : DataverseBaseService
{
    public DeleteTableTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<DeleteTableTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    /// <summary>
    /// Delete a table from Dataverse
    /// </summary>
    public async Task<DeleteTableResult> ExecuteAsync(string tableName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateDataverseClientAsync(ct);

            // First get the MetadataId
            var getResponse = await client.GetAsync($"EntityDefinitions(LogicalName='{tableName}')?$select=MetadataId", ct);
            getResponse.EnsureSuccessStatusCode();
            var getContent = await getResponse.Content.ReadAsStringAsync(ct);
            var metadata = JsonSerializer.Deserialize<JsonElement>(getContent, JsonOptions);
            var metadataId = metadata.GetProperty("MetadataId").GetString();

            // Delete the entity
            var response = await client.DeleteAsync($"EntityDefinitions({metadataId})", ct);
            response.EnsureSuccessStatusCode();

            return new DeleteTableResult { TableName = tableName, Success = true };
        }, "DeleteTable", ct);
    }
}

public record DeleteTableResult
{
    public required string TableName { get; init; }
    public bool Success { get; init; }
}
