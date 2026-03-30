namespace AzureConduit.Mcp.Fabric.Tools.Docs;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

/// <summary>
/// Retrieve JSON schema definitions for items in Fabric workload APIs
/// </summary>
public class GetItemDefinitionsTool : FabricBaseService
{
    public GetItemDefinitionsTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetItemDefinitionsTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public Task<ItemDefinitionsResult> ExecuteAsync(string itemType, CancellationToken ct = default)
    {
        var definition = itemType.ToLower() switch
        {
            "lakehouse" => GetLakehouseDefinition(),
            "warehouse" => GetWarehouseDefinition(),
            "notebook" => GetNotebookDefinition(),
            "datapipeline" or "pipeline" => GetPipelineDefinition(),
            _ => throw new KeyNotFoundException($"Unknown item type: {itemType}")
        };

        return Task.FromResult(new ItemDefinitionsResult { Definition = definition });
    }

    private static ItemDefinition GetLakehouseDefinition() => new()
    {
        Type = "Lakehouse",
        RequiredProperties = new[] { "displayName" },
        Properties = new Dictionary<string, PropertyDefinition>
        {
            ["displayName"] = new() { Type = "string", Description = "Display name of the lakehouse", MaxLength = 256 },
            ["description"] = new() { Type = "string", Description = "Description of the lakehouse", MaxLength = 4000 }
        },
        CreatedProperties = new[] { "id", "workspaceId", "properties.oneLakeTablesPath", "properties.oneLakeFilesPath", "properties.sqlEndpointProperties" }
    };

    private static ItemDefinition GetWarehouseDefinition() => new()
    {
        Type = "Warehouse",
        RequiredProperties = new[] { "displayName" },
        Properties = new Dictionary<string, PropertyDefinition>
        {
            ["displayName"] = new() { Type = "string", Description = "Display name of the warehouse", MaxLength = 256 },
            ["description"] = new() { Type = "string", Description = "Description of the warehouse", MaxLength = 4000 }
        },
        CreatedProperties = new[] { "id", "workspaceId", "properties.connectionString" }
    };

    private static ItemDefinition GetNotebookDefinition() => new()
    {
        Type = "Notebook",
        RequiredProperties = new[] { "displayName" },
        Properties = new Dictionary<string, PropertyDefinition>
        {
            ["displayName"] = new() { Type = "string", Description = "Display name of the notebook", MaxLength = 256 },
            ["description"] = new() { Type = "string", Description = "Description of the notebook", MaxLength = 4000 }
        },
        CreatedProperties = new[] { "id", "workspaceId" }
    };

    private static ItemDefinition GetPipelineDefinition() => new()
    {
        Type = "DataPipeline",
        RequiredProperties = new[] { "displayName" },
        Properties = new Dictionary<string, PropertyDefinition>
        {
            ["displayName"] = new() { Type = "string", Description = "Display name of the pipeline", MaxLength = 256 },
            ["description"] = new() { Type = "string", Description = "Description of the pipeline", MaxLength = 4000 }
        },
        CreatedProperties = new[] { "id", "workspaceId" }
    };
}

public record ItemDefinitionsResult
{
    public required ItemDefinition Definition { get; init; }
}

public record ItemDefinition
{
    public required string Type { get; init; }
    public required string[] RequiredProperties { get; init; }
    public required Dictionary<string, PropertyDefinition> Properties { get; init; }
    public required string[] CreatedProperties { get; init; }
}

public record PropertyDefinition
{
    public required string Type { get; init; }
    public required string Description { get; init; }
    public int? MaxLength { get; init; }
}
