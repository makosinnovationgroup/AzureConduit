namespace AzureConduit.Mcp.D365.Tools.Data;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Create data records using OData
/// </summary>
public class CreateEntitiesTool : D365BaseService
{
    public CreateEntitiesTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<CreateEntitiesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<CreateEntitiesResult> ExecuteAsync(
        string entityName,
        Dictionary<string, object> data,
        CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateD365ClientAsync(ct);

            var json = JsonSerializer.Serialize(data, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync(entityName, content, ct);
            response.EnsureSuccessStatusCode();

            // Try to get the created entity ID from response
            string? entityId = null;
            if (response.Headers.TryGetValues("OData-EntityId", out var values))
            {
                var entityIdUrl = values.FirstOrDefault();
                if (!string.IsNullOrEmpty(entityIdUrl))
                {
                    // Extract ID from URL like "...Customers('CUST001')"
                    var start = entityIdUrl.LastIndexOf('(');
                    var end = entityIdUrl.LastIndexOf(')');
                    if (start > 0 && end > start)
                    {
                        entityId = entityIdUrl.Substring(start + 1, end - start - 1).Trim('\'');
                    }
                }
            }

            return new CreateEntitiesResult
            {
                EntityName = entityName,
                EntityId = entityId,
                Success = true
            };
        }, "CreateEntities", ct);
    }
}

public record CreateEntitiesResult
{
    public required string EntityName { get; init; }
    public string? EntityId { get; init; }
    public bool Success { get; init; }
}
