namespace AzureConduit.Mcp.D365.Tools.Form;

using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Azure.Core;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Exceptions;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Base class for D365 Form tools that interact with the UI automation API
/// </summary>
public abstract class FormToolBase
{
    protected readonly IOboTokenCredentialProvider CredentialProvider;
    protected readonly D365Configuration D365Config;
    protected readonly IHttpClientFactory HttpClientFactory;
    protected readonly ILogger Logger;

    protected static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    protected FormToolBase(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory,
        ILogger logger)
    {
        CredentialProvider = credentialProvider;
        D365Config = config.Value;
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

    /// <summary>
    /// Creates an HTTP client for the D365 Form Automation API
    /// The Form API endpoint is typically at: {environmentUrl}/api/formautomation/v1/
    /// </summary>
    protected async Task<HttpClient> CreateFormClientAsync(CancellationToken ct)
    {
        var credential = GetUserCredential();
        var scope = D365Config.GetScope();
        var token = await credential.GetTokenAsync(new TokenRequestContext(new[] { scope }), ct);

        var client = HttpClientFactory.CreateClient("D365Forms");
        client.BaseAddress = new Uri($"{D365Config.EnvironmentUrl.TrimEnd('/')}/api/formautomation/v1/");
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token.Token);
        client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

        return client;
    }

    protected async Task<T> ExecuteAsync<T>(Func<Task<T>> operation, string operationName, CancellationToken ct)
    {
        try
        {
            Logger.LogInformation("Executing D365 Form operation: {Operation}", operationName);
            return await operation();
        }
        catch (OboAuthenticationException) { throw; }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            Logger.LogWarning("Unauthorized access to D365 Form API during {Operation}", operationName);
            throw new UnauthorizedAccessException($"Access denied to D365 Form API: {ex.Message}");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            Logger.LogWarning("Form resource not found during {Operation}", operationName);
            throw new KeyNotFoundException($"Form resource not found: {ex.Message}");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error executing D365 Form operation: {Operation}", operationName);
            throw;
        }
    }
}

/// <summary>
/// Represents an active form session
/// </summary>
public record FormSession
{
    public required string SessionId { get; init; }
    public required string FormName { get; init; }
    public string? RecordId { get; init; }
}
