namespace AzureConduit.Mcp.D365.Tools.Data;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Delete data records using OData
/// </summary>
public class DeleteEntitiesTool : D365BaseService
{
    public DeleteEntitiesTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<DeleteEntitiesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<DeleteEntitiesResult> ExecuteAsync(
        string entityName,
        string entityKey,
        CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateD365ClientAsync(ct);

            var response = await client.DeleteAsync($"{entityName}({entityKey})", ct);
            response.EnsureSuccessStatusCode();

            return new DeleteEntitiesResult
            {
                EntityName = entityName,
                EntityKey = entityKey,
                Success = true
            };
        }, "DeleteEntities", ct);
    }
}

public record DeleteEntitiesResult
{
    public required string EntityName { get; init; }
    public required string EntityKey { get; init; }
    public bool Success { get; init; }
}
