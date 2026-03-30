namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class CreateTableTool : DataverseBaseService
{
    public CreateTableTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<CreateTableTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    /// <summary>
    /// Create a new table with a specified schema
    /// </summary>
    public async Task<CreateTableResult> ExecuteAsync(
        string schemaName,
        string displayName,
        string pluralName,
        string? description = null,
        List<CreateColumnDefinition>? columns = null,
        CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateDataverseClientAsync(ct);

            // Build entity definition
            var entityDef = new Dictionary<string, object>
            {
                ["@odata.type"] = "Microsoft.Dynamics.CRM.EntityMetadata",
                ["SchemaName"] = schemaName,
                ["DisplayName"] = new Dictionary<string, object>
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
                },
                ["DisplayCollectionName"] = new Dictionary<string, object>
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
                },
                ["HasNotes"] = false,
                ["HasActivities"] = false,
                ["OwnershipType"] = "UserOwned",
                ["PrimaryNameAttribute"] = $"{schemaName.ToLower()}_name"
            };

            if (!string.IsNullOrEmpty(description))
            {
                entityDef["Description"] = new Dictionary<string, object>
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

            // Add primary name attribute
            entityDef["Attributes"] = new List<object>
            {
                new Dictionary<string, object>
                {
                    ["@odata.type"] = "Microsoft.Dynamics.CRM.StringAttributeMetadata",
                    ["SchemaName"] = $"{schemaName}_Name",
                    ["RequiredLevel"] = new Dictionary<string, object>
                    {
                        ["Value"] = "ApplicationRequired",
                        ["CanBeChanged"] = true
                    },
                    ["MaxLength"] = 100,
                    ["DisplayName"] = new Dictionary<string, object>
                    {
                        ["@odata.type"] = "Microsoft.Dynamics.CRM.Label",
                        ["LocalizedLabels"] = new[]
                        {
                            new Dictionary<string, object>
                            {
                                ["@odata.type"] = "Microsoft.Dynamics.CRM.LocalizedLabel",
                                ["Label"] = "Name",
                                ["LanguageCode"] = 1033
                            }
                        }
                    },
                    ["IsPrimaryName"] = true
                }
            };

            var json = JsonSerializer.Serialize(entityDef, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync("EntityDefinitions", content, ct);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<JsonElement>(responseContent, JsonOptions);
            var logicalName = result.TryGetProperty("LogicalName", out var ln) ? ln.GetString() ?? "" : schemaName.ToLower();

            return new CreateTableResult
            {
                SchemaName = schemaName,
                LogicalName = logicalName,
                Success = true
            };
        }, "CreateTable", ct);
    }
}

public record CreateTableResult
{
    public required string SchemaName { get; init; }
    public required string LogicalName { get; init; }
    public bool Success { get; init; }
}

public record CreateColumnDefinition
{
    public required string SchemaName { get; init; }
    public required string DisplayName { get; init; }
    public required string Type { get; init; } // String, Integer, DateTime, Boolean, etc.
    public bool IsRequired { get; init; }
    public int? MaxLength { get; init; }
}
