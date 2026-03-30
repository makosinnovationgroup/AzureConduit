namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class UpdateRecordTool : DataverseBaseService
{
    public UpdateRecordTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<UpdateRecordTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<UpdateRecordResult> ExecuteAsync(string tableName, string recordId, Dictionary<string, object> data, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateDataverseClientAsync(ct);
            var json = JsonSerializer.Serialize(data);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var request = new HttpRequestMessage(HttpMethod.Patch, $"{tableName}({recordId})") { Content = content };
            var response = await client.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();

            return new UpdateRecordResult { TableName = tableName, RecordId = recordId, Success = true };
        }, "UpdateRecord", ct);
    }
}

public record UpdateRecordResult { public required string TableName { get; init; } public required string RecordId { get; init; } public bool Success { get; init; } }
