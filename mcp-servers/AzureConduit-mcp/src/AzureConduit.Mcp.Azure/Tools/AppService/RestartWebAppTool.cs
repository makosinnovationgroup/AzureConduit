namespace AzureConduit.Mcp.Azure.Tools.AppService;

using Azure.ResourceManager;
using Azure.ResourceManager.AppService;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class RestartWebAppTool : OboEnabledBaseService
{
    public RestartWebAppTool(IOboTokenCredentialProvider credentialProvider, ILogger<RestartWebAppTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<RestartWebAppResult> ExecuteAsync(string subscriptionId, string resourceGroup, string appName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var app = client.GetWebSiteResource(
                WebSiteResource.CreateResourceIdentifier(subscriptionId, resourceGroup, appName));

            await app.RestartAsync(ct: ct);

            return new RestartWebAppResult { AppName = appName, Success = true };
        }, "RestartWebApp", ct);
    }
}

public record RestartWebAppResult
{
    public required string AppName { get; init; }
    public bool Success { get; init; }
}
