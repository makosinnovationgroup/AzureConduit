namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class CreateRecordTool : DataverseBaseService
{
    public CreateRecordTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<CreateRecordTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<CreateRecordResult> ExecuteAsync(string tableName, Dictionary<string, object> data, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateDataverseClientAsync(ct);
            var json = JsonSerializer.Serialize(data);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync(tableName, content, ct);
            response.EnsureSuccessStatusCode();

            var recordId = response.Headers.GetValues("OData-EntityId").FirstOrDefault();
            var id = recordId?.Split('(', ')').ElementAtOrDefault(1) ?? "";

            return new CreateRecordResult { TableName = tableName, RecordId = id, Success = true };
        }, "CreateRecord", ct);
    }
}

public record CreateRecordResult { public required string TableName { get; init; } public required string RecordId { get; init; } public bool Success { get; init; } }
