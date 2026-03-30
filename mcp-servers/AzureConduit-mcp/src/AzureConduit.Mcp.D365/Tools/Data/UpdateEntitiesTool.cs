namespace AzureConduit.Mcp.D365.Tools.Data;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Update data records using OData
/// </summary>
public class UpdateEntitiesTool : D365BaseService
{
    public UpdateEntitiesTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<UpdateEntitiesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<UpdateEntitiesResult> ExecuteAsync(
        string entityName,
        string entityKey,
        Dictionary<string, object> data,
        CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateD365ClientAsync(ct);

            var json = JsonSerializer.Serialize(data, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // Use PATCH for partial update
            var request = new HttpRequestMessage(HttpMethod.Patch, $"{entityName}({entityKey})")
            {
                Content = content
            };

            var response = await client.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();

            return new UpdateEntitiesResult
            {
                EntityName = entityName,
                EntityKey = entityKey,
                Success = true
            };
        }, "UpdateEntities", ct);
    }
}

public record UpdateEntitiesResult
{
    public required string EntityName { get; init; }
    public required string EntityKey { get; init; }
    public bool Success { get; init; }
}
