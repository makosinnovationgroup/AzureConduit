namespace AzureConduit.Mcp.Fabric.Tools;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

public class CreateWorkspaceTool : FabricBaseService
{
    public CreateWorkspaceTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<CreateWorkspaceTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<WorkspaceDetails> ExecuteAsync(string displayName, string? description = null, string? capacityId = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateFabricClientAsync(ct);

            var payload = new Dictionary<string, object?>
            {
                ["displayName"] = displayName,
                ["description"] = description,
                ["capacityId"] = capacityId ?? FabricConfig.DefaultCapacityId
            };

            var json = JsonSerializer.Serialize(payload.Where(kv => kv.Value != null).ToDictionary(kv => kv.Key, kv => kv.Value), JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync("/workspaces", content, ct);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<WorkspaceDetails>(responseContent, JsonOptions)
                ?? throw new InvalidOperationException("Failed to deserialize created workspace");
        }, "CreateWorkspace", ct);
    }
}
