namespace AzureConduit.Mcp.Fabric.Tools.Core;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

/// <summary>
/// Create new Fabric items (Lakehouses, Notebooks, Warehouses, etc.)
/// </summary>
public class CreateItemTool : FabricBaseService
{
    public CreateItemTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<CreateItemTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<CreateItemResult> ExecuteAsync(string workspaceId, string itemType, string displayName, string? description = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);

            var endpoint = GetEndpointForItemType(itemType);
            var payload = new Dictionary<string, object?>
            {
                ["displayName"] = displayName,
                ["description"] = description
            };

            var json = JsonSerializer.Serialize(payload.Where(kv => kv.Value != null).ToDictionary(kv => kv.Key, kv => kv.Value), JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"/workspaces/{workspaceId}/{endpoint}", content, ct);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<JsonElement>(responseContent, JsonOptions);

            return new CreateItemResult
            {
                WorkspaceId = workspaceId,
                ItemType = itemType,
                ItemId = result.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
                DisplayName = displayName,
                Success = true
            };
        }, "CreateItem", ct);
    }

    private static string GetEndpointForItemType(string itemType) => itemType.ToLower() switch
    {
        "lakehouse" => "lakehouses",
        "warehouse" => "warehouses",
        "notebook" => "notebooks",
        "datapipeline" or "pipeline" => "dataPipelines",
        "report" => "reports",
        "dashboard" => "dashboards",
        "dataset" or "semanticmodel" => "semanticModels",
        "eventstream" => "eventstreams",
        "kqldatabase" => "kqlDatabases",
        "mlmodel" => "mlModels",
        "mlexperiment" => "mlExperiments",
        "sparkjobdefinition" => "sparkJobDefinitions",
        _ => throw new ArgumentException($"Unknown item type: {itemType}")
    };
}

public record CreateItemResult
{
    public required string WorkspaceId { get; init; }
    public required string ItemType { get; init; }
    public required string ItemId { get; init; }
    public required string DisplayName { get; init; }
    public bool Success { get; init; }
}
