namespace AzureConduit.Mcp.Azure.Tools.AppService;

using Azure.ResourceManager;
using Azure.ResourceManager.AppService;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;

public class GetWebAppTool : OboEnabledBaseService
{
    public GetWebAppTool(IOboTokenCredentialProvider credentialProvider, ILogger<GetWebAppTool> logger)
        : base(credentialProvider, logger) { }

    public async Task<WebAppDetails> ExecuteAsync(string subscriptionId, string resourceGroup, string appName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            var client = CreateArmClient();
            var app = await client.GetWebSiteResource(
                WebSiteResource.CreateResourceIdentifier(subscriptionId, resourceGroup, appName)).GetAsync(ct);

            var data = app.Value.Data;
            return new WebAppDetails
            {
                Id = data.Id?.ToString() ?? "",
                Name = data.Name,
                Location = data.Location?.Name ?? "",
                State = data.State ?? "",
                DefaultHostName = data.DefaultHostName ?? "",
                Kind = data.Kind ?? "",
                HttpsOnly = data.IsHttpsOnly ?? false,
                AppServicePlanId = data.AppServicePlanId?.ToString() ?? "",
                OutboundIpAddresses = data.OutboundIPAddresses ?? "",
                RuntimeStack = data.SiteConfig?.LinuxFxVersion ?? data.SiteConfig?.WindowsFxVersion ?? ""
            };
        }, "GetWebApp", ct);
    }
}

public record WebAppDetails
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Location { get; init; }
    public required string State { get; init; }
    public required string DefaultHostName { get; init; }
    public required string Kind { get; init; }
    public bool HttpsOnly { get; init; }
    public required string AppServicePlanId { get; init; }
    public required string OutboundIpAddresses { get; init; }
    public required string RuntimeStack { get; init; }
}
