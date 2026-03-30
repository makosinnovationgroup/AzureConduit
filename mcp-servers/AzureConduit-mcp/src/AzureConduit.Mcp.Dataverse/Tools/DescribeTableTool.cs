namespace AzureConduit.Mcp.Dataverse.Tools;

using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Dataverse.Configuration;
using AzureConduit.Mcp.Dataverse.Services;

public class DescribeTableTool : DataverseBaseService
{
    public DescribeTableTool(IOboTokenCredentialProvider credentialProvider, IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<DescribeTableTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    /// <summary>
    /// Retrieve the schema of a specified table including field names, data types, and relationships
    /// </summary>
    public async Task<TableSchema> ExecuteAsync(string tableName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateDataverseClientAsync(ct);

            // Get entity metadata with attributes
            var response = await client.GetAsync(
                $"EntityDefinitions(LogicalName='{tableName}')?$expand=Attributes", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var metadata = JsonSerializer.Deserialize<JsonElement>(content, JsonOptions);

            var columns = new List<ColumnSchema>();
            var relationships = new List<RelationshipSchema>();

            if (metadata.TryGetProperty("Attributes", out var attributes))
            {
                foreach (var attr in attributes.EnumerateArray())
                {
                    var logicalName = attr.GetProperty("LogicalName").GetString() ?? "";
                    var displayName = "";
                    if (attr.TryGetProperty("DisplayName", out var dn) &&
                        dn.TryGetProperty("UserLocalizedLabel", out var label) &&
                        label.TryGetProperty("Label", out var labelText))
                    {
                        displayName = labelText.GetString() ?? logicalName;
                    }

                    columns.Add(new ColumnSchema
                    {
                        LogicalName = logicalName,
                        DisplayName = displayName,
                        AttributeType = attr.TryGetProperty("AttributeTypeName", out var atn)
                            ? atn.GetProperty("Value").GetString() ?? "Unknown"
                            : "Unknown",
                        IsRequired = attr.TryGetProperty("RequiredLevel", out var rl) &&
                            rl.TryGetProperty("Value", out var rlv) &&
                            rlv.GetString() == "ApplicationRequired",
                        MaxLength = attr.TryGetProperty("MaxLength", out var ml) ? ml.GetInt32() : null,
                        IsPrimaryKey = attr.TryGetProperty("IsPrimaryId", out var pk) && pk.GetBoolean()
                    });
                }
            }

            // Get relationships
            var relResponse = await client.GetAsync(
                $"EntityDefinitions(LogicalName='{tableName}')/ManyToOneRelationships", ct);
            if (relResponse.IsSuccessStatusCode)
            {
                var relContent = await relResponse.Content.ReadAsStringAsync(ct);
                var relData = JsonSerializer.Deserialize<JsonElement>(relContent, JsonOptions);

                if (relData.TryGetProperty("value", out var rels))
                {
                    foreach (var rel in rels.EnumerateArray())
                    {
                        relationships.Add(new RelationshipSchema
                        {
                            SchemaName = rel.TryGetProperty("SchemaName", out var sn) ? sn.GetString() ?? "" : "",
                            ReferencedEntity = rel.TryGetProperty("ReferencedEntity", out var re) ? re.GetString() ?? "" : "",
                            ReferencingAttribute = rel.TryGetProperty("ReferencingAttribute", out var ra) ? ra.GetString() ?? "" : "",
                            RelationshipType = "ManyToOne"
                        });
                    }
                }
            }

            return new TableSchema
            {
                LogicalName = tableName,
                DisplayName = metadata.TryGetProperty("DisplayName", out var dn2) &&
                    dn2.TryGetProperty("UserLocalizedLabel", out var lbl2) &&
                    lbl2.TryGetProperty("Label", out var lblText2)
                    ? lblText2.GetString() ?? tableName : tableName,
                PrimaryIdAttribute = metadata.TryGetProperty("PrimaryIdAttribute", out var pia) ? pia.GetString() ?? "" : "",
                PrimaryNameAttribute = metadata.TryGetProperty("PrimaryNameAttribute", out var pna) ? pna.GetString() ?? "" : "",
                Columns = columns,
                Relationships = relationships
            };
        }, "DescribeTable", ct);
    }
}

public record TableSchema
{
    public required string LogicalName { get; init; }
    public required string DisplayName { get; init; }
    public required string PrimaryIdAttribute { get; init; }
    public required string PrimaryNameAttribute { get; init; }
    public required List<ColumnSchema> Columns { get; init; }
    public required List<RelationshipSchema> Relationships { get; init; }
}

public record ColumnSchema
{
    public required string LogicalName { get; init; }
    public required string DisplayName { get; init; }
    public required string AttributeType { get; init; }
    public bool IsRequired { get; init; }
    public int? MaxLength { get; init; }
    public bool IsPrimaryKey { get; init; }
}

public record RelationshipSchema
{
    public required string SchemaName { get; init; }
    public required string ReferencedEntity { get; init; }
    public required string ReferencingAttribute { get; init; }
    public required string RelationshipType { get; init; }
}
