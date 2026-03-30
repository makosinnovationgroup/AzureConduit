namespace AzureConduit.Mcp.Dataverse.Services;

using System.Net.Http.Headers;
using System.Text.Json;
using Azure.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Services;
using AzureConduit.Mcp.Dataverse.Configuration;

public abstract class DataverseBaseService : OboEnabledBaseService
{
    protected readonly DataverseConfiguration Config;
    protected readonly IHttpClientFactory HttpClientFactory;
    protected static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    protected DataverseBaseService(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<DataverseConfiguration> config,
        IHttpClientFactory httpClientFactory,
        ILogger logger)
        : base(credentialProvider, logger)
    {
        Config = config.Value;
        HttpClientFactory = httpClientFactory;
    }

    protected async Task<HttpClient> CreateDataverseClientAsync(CancellationToken ct)
    {
        var credential = GetUserCredential();
        var token = await credential.GetTokenAsync(new TokenRequestContext(new[] { Config.GetScope() }), ct);
        var client = HttpClientFactory.CreateClient("Dataverse");
        client.BaseAddress = new Uri($"{Config.EnvironmentUrl.TrimEnd('/')}/api/data/v9.2/");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return client;
    }

    protected async Task<T> GetAsync<T>(string endpoint, CancellationToken ct)
    {
        using var client = await CreateDataverseClientAsync(ct);
        var response = await client.GetAsync(endpoint, ct);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<T>(content, JsonOptions)!;
    }

    protected async Task<List<T>> GetCollectionAsync<T>(string endpoint, CancellationToken ct)
    {
        var result = await GetAsync<ODataResponse<T>>(endpoint, ct);
        return result.Value ?? new List<T>();
    }

    protected class ODataResponse<T> { public List<T>? Value { get; set; } }
}
