namespace AzureConduit.Mcp.D365.Services;

using System.Net.Http.Headers;
using System.Text.Json;
using Azure.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Exceptions;
using AzureConduit.Mcp.Core.Services;
using AzureConduit.Mcp.D365.Configuration;

/// <summary>
/// Base service for D365 F&O API operations.
/// Provides authenticated HTTP client for OData calls.
/// </summary>
public abstract class D365BaseService : OboEnabledBaseService
{
    protected readonly D365Configuration D365Config;
    protected readonly IHttpClientFactory HttpClientFactory;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    protected D365BaseService(
        IOboTokenCredentialProvider credentialProvider,
        IOptions<D365Configuration> d365Config,
        IHttpClientFactory httpClientFactory,
        ILogger logger)
        : base(credentialProvider, logger)
    {
        D365Config = d365Config.Value;
        HttpClientFactory = httpClientFactory;
    }

    /// <summary>
    /// Creates an HTTP client authenticated with the user's OBO token for D365.
    /// </summary>
    protected async Task<HttpClient> CreateD365ClientAsync(CancellationToken cancellationToken)
    {
        var credential = GetUserCredential();
        var scope = D365Config.GetScope();
        var tokenContext = new TokenRequestContext(new[] { scope });
        var token = await credential.GetTokenAsync(tokenContext, cancellationToken);

        var client = HttpClientFactory.CreateClient("D365");
        client.BaseAddress = new Uri(D365Config.GetODataBaseUrl());
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token.Token);
        client.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));

        return client;
    }

    /// <summary>
    /// Executes an OData GET request and deserializes the response.
    /// </summary>
    protected async Task<T> GetODataAsync<T>(
        string endpoint,
        CancellationToken cancellationToken)
    {
        using var client = await CreateD365ClientAsync(cancellationToken);
        var response = await client.GetAsync(endpoint, cancellationToken);

        await EnsureSuccessAsync(response, cancellationToken);

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<T>(content, JsonOptions)
            ?? throw new InvalidOperationException("Failed to deserialize D365 response");
    }

    /// <summary>
    /// Executes an OData GET request for a collection and extracts the value array.
    /// </summary>
    protected async Task<List<T>> GetODataCollectionAsync<T>(
        string endpoint,
        CancellationToken cancellationToken)
    {
        var response = await GetODataAsync<ODataCollectionResponse<T>>(endpoint, cancellationToken);
        return response.Value ?? new List<T>();
    }

    /// <summary>
    /// Ensures the HTTP response indicates success, throwing appropriate exceptions otherwise.
    /// </summary>
    protected async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
            return;

        var content = await response.Content.ReadAsStringAsync(cancellationToken);

        switch ((int)response.StatusCode)
        {
            case 401:
                throw OboAuthenticationException.InvalidGrant(
                    "D365 authentication failed. User token may be expired.");

            case 403:
                throw new UnauthorizedAccessException(
                    $"Access denied to D365. User does not have permission. {content}");

            case 404:
                throw new KeyNotFoundException(
                    $"D365 resource not found. {content}");

            default:
                throw new InvalidOperationException(
                    $"D365 API request failed with status {response.StatusCode}: {content}");
        }
    }
}

/// <summary>
/// Standard OData collection response wrapper.
/// </summary>
public class ODataCollectionResponse<T>
{
    public List<T>? Value { get; set; }
    public string? ODataContext { get; set; }
    public string? ODataNextLink { get; set; }
    public int? ODataCount { get; set; }
}
