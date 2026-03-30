namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class UpdateTableTool : DataverseBaseService
{
    public UpdateTableTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<UpdateTableTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    /// <summary>
    /// Modify schema or metadata of an existing table
    /// </summary>
    public async Task<UpdateTableResult> ExecuteAsync(
        string tableName,
        string? displayName = null,
        string? pluralName = null,
        string? description = null,
        CancellationToken ct = default)
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

            // Build update payload
            var updateDef = new Dictionary<string, object>();

            if (!string.IsNullOrEmpty(displayName))
            {
                updateDef["DisplayName"] = new Dictionary<string, object>
                {
                    ["@odata.type"] = "Microsoft.Dynamics.CRM.Label",
                    ["LocalizedLabels"] = new[]
                    {
                        new Dictionary<string, object>
                        {
                            ["@odata.type"] = "Microsoft.Dynamics.CRM.LocalizedLabel",
                            ["Label"] = displayName,
                            ["LanguageCode"] = 1033
                        }
                    }
                };
            }

            if (!string.IsNullOrEmpty(pluralName))
            {
                updateDef["DisplayCollectionName"] = new Dictionary<string, object>
                {
                    ["@odata.type"] = "Microsoft.Dynamics.CRM.Label",
                    ["LocalizedLabels"] = new[]
                    {
                        new Dictionary<string, object>
                        {
                            ["@odata.type"] = "Microsoft.Dynamics.CRM.LocalizedLabel",
                            ["Label"] = pluralName,
                            ["LanguageCode"] = 1033
                        }
                    }
                };
            }

            if (!string.IsNullOrEmpty(description))
            {
                updateDef["Description"] = new Dictionary<string, object>
                {
                    ["@odata.type"] = "Microsoft.Dynamics.CRM.Label",
                    ["LocalizedLabels"] = new[]
                    {
                        new Dictionary<string, object>
                        {
                            ["@odata.type"] = "Microsoft.Dynamics.CRM.LocalizedLabel",
                            ["Label"] = description,
                            ["LanguageCode"] = 1033
                        }
                    }
                };
            }

            if (updateDef.Count == 0)
            {
                return new UpdateTableResult { TableName = tableName, Success = true, Message = "No changes specified" };
            }

            var json = JsonSerializer.Serialize(updateDef, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Put, $"EntityDefinitions({metadataId})")
            {
                Content = content
            };
            var response = await client.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();

            return new UpdateTableResult { TableName = tableName, Success = true };
        }, "UpdateTable", ct);
    }
}

public record UpdateTableResult
{
    public required string TableName { get; init; }
    public bool Success { get; init; }
    public string? Message { get; init; }
}
