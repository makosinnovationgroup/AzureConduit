namespace AzureConduit.Mcp.Fabric.Services;

using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Azure.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Exceptions;
using AzureConduit.Mcp.Fabric.Configuration;

public abstract class FabricBaseService
{
    protected readonly IOboTokenCredentialProvider CredentialProvider;
    protected readonly FabricConfiguration FabricConfig;
    protected readonly IHttpClientFactory HttpClientFactory;
    protected readonly ILogger Logger;

    protected static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    protected FabricBaseService(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory,
        ILogger logger)
    {
        CredentialProvider = credentialProvider;
        FabricConfig = config.Value;
        HttpClientFactory = httpClientFactory;
        Logger = logger;
    }

    protected TokenCredential GetUserCredential()
    {
        var credential = CredentialProvider.GetCredential();
        if (credential == null)
            throw new OboAuthenticationException("no_user_token", "User authentication token not found");
        return credential;
    }

    protected async Task<HttpClient> CreateFabricClientAsync(CancellationToken cancellationToken)
    {
        var credential = GetUserCredential();
        var scope = FabricConfig.GetScope();
        var token = await credential.GetTokenAsync(
            new TokenRequestContext(new[] { scope }),
            cancellationToken);

        var client = HttpClientFactory.CreateClient("Fabric");
        client.BaseAddress = new Uri(FabricConfig.BaseUrl);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        return client;
    }

    protected async Task<T> ExecuteAsync<T>(Func<Task<T>> operation, string operationName, CancellationToken ct)
    {
        try
        {
            Logger.LogInformation("Executing Fabric operation: {Operation}", operationName);
            return await operation();
        }
        catch (OboAuthenticationException)
        {
            throw;
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            Logger.LogWarning("Unauthorized access to Fabric API during {Operation}", operationName);
            throw new UnauthorizedAccessException($"Access denied to Fabric API: {ex.Message}");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            Logger.LogWarning("Resource not found during {Operation}", operationName);
            throw new KeyNotFoundException($"Resource not found: {ex.Message}");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error executing Fabric operation: {Operation}", operationName);
            throw;
        }
    }
}

public class ODataResponse<T>
{
    [JsonPropertyName("value")]
    public List<T>? Value { get; set; }

    [JsonPropertyName("@odata.nextLink")]
    public string? NextLink { get; set; }

    [JsonPropertyName("continuationToken")]
    public string? ContinuationToken { get; set; }
}
