namespace AzureConduit.Mcp.Fabric.Tools.OneLake;

using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Azure.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Exceptions;
using AzureConduit.Mcp.Fabric.Configuration;

/// <summary>
/// Base service for OneLake DFS operations (ADLS Gen2 compatible)
/// </summary>
public abstract class OneLakeBaseService
{
    protected const string OneLakeDfsUrl = "https://onelake.dfs.fabric.microsoft.com";
    protected const string OneLakeScope = "https://storage.azure.com/.default";

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

    protected OneLakeBaseService(
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

    protected async Task<HttpClient> CreateOneLakeClientAsync(CancellationToken ct)
    {
        var credential = GetUserCredential();
        var token = await credential.GetTokenAsync(new TokenRequestContext(new[] { OneLakeScope }), ct);

        var client = HttpClientFactory.CreateClient("OneLake");
        client.BaseAddress = new Uri(OneLakeDfsUrl);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
        client.DefaultRequestHeaders.Add("x-ms-version", "2021-06-08");

        return client;
    }

    protected async Task<T> ExecuteAsync<T>(Func<Task<T>> operation, string operationName, CancellationToken ct)
    {
        try
        {
            Logger.LogInformation("Executing OneLake operation: {Operation}", operationName);
            return await operation();
        }
        catch (OboAuthenticationException) { throw; }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            Logger.LogWarning("Unauthorized access to OneLake during {Operation}", operationName);
            throw new UnauthorizedAccessException($"Access denied to OneLake: {ex.Message}");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            Logger.LogWarning("Resource not found during {Operation}", operationName);
            throw new KeyNotFoundException($"OneLake resource not found: {ex.Message}");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error executing OneLake operation: {Operation}", operationName);
            throw;
        }
    }

    protected static string BuildOneLakePath(string workspaceName, string itemName, string? relativePath = null)
    {
        var path = $"/{workspaceName}/{itemName}";
        if (!string.IsNullOrEmpty(relativePath))
        {
            path += "/" + relativePath.TrimStart('/');
        }
        return path;
    }
}
