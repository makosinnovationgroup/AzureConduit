namespace AzureConduit.Mcp.Dataverse.Tools;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class DeleteRecordTool : DataverseBaseService
{
    public DeleteRecordTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<DeleteRecordTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<DeleteRecordResult> ExecuteAsync(string tableName, string recordId, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateDataverseClientAsync(ct);
            var response = await client.DeleteAsync($"{tableName}({recordId})", ct);
            response.EnsureSuccessStatusCode();

            return new DeleteRecordResult { TableName = tableName, RecordId = recordId, Success = true };
        }, "DeleteRecord", ct);
    }
}

public record DeleteRecordResult { public required string TableName { get; init; } public required string RecordId { get; init; } public bool Success { get; init; } }
