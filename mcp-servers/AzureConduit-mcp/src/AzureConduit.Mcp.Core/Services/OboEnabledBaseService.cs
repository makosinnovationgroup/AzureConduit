namespace AzureConduit.Mcp.Core.Services;

using Azure;
using Azure.Core;
using Azure.ResourceManager;
using Microsoft.Extensions.Logging;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Exceptions;

/// <summary>
/// Base class for MCP tool services that need OBO authentication.
/// Provides easy access to user-scoped Azure SDK clients.
/// </summary>
public abstract class OboEnabledBaseService
{
    /// <summary>
    /// The OBO credential provider for creating user-scoped credentials.
    /// </summary>
    protected IOboTokenCredentialProvider CredentialProvider { get; }

    /// <summary>
    /// Logger instance for the service.
    /// </summary>
    protected ILogger Logger { get; }

    /// <summary>
    /// Creates a new OBO-enabled service.
    /// </summary>
    protected OboEnabledBaseService(
        IOboTokenCredentialProvider credentialProvider,
        ILogger logger)
    {
        CredentialProvider = credentialProvider ?? throw new ArgumentNullException(nameof(credentialProvider));
        Logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Gets a TokenCredential for calling Azure APIs as the current user.
    /// </summary>
    protected TokenCredential GetUserCredential()
    {
        return CredentialProvider.GetCredential();
    }

    /// <summary>
    /// Gets a TokenCredential for a specific tenant.
    /// </summary>
    protected TokenCredential GetUserCredential(string tenantId)
    {
        return CredentialProvider.GetCredential(tenantId);
    }

    /// <summary>
    /// Creates an ARM client authenticated as the current user.
    /// </summary>
    protected ArmClient CreateArmClient()
    {
        Logger.LogDebug("Creating ARM client with user credentials");
        return new ArmClient(GetUserCredential());
    }

    /// <summary>
    /// Creates an ARM client for a specific subscription.
    /// </summary>
    protected ArmClient CreateArmClient(string subscriptionId)
    {
        Logger.LogDebug("Creating ARM client for subscription {SubscriptionId}", subscriptionId);
        return new ArmClient(GetUserCredential(), subscriptionId);
    }

    /// <summary>
    /// Creates an HTTP client with the user's bearer token for a specific API.
    /// </summary>
    protected async Task<HttpClient> CreateAuthenticatedHttpClientAsync(
        string baseUrl,
        string[] scopes,
        CancellationToken cancellationToken = default)
    {
        var credential = GetUserCredential();
        var tokenContext = new TokenRequestContext(scopes);
        var token = await credential.GetTokenAsync(tokenContext, cancellationToken);

        var client = new HttpClient
        {
            BaseAddress = new Uri(baseUrl)
        };

        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token.Token);

        return client;
    }

    /// <summary>
    /// Wraps an async operation with standard error handling.
    /// Converts Azure SDK exceptions to MCP-friendly exceptions.
    /// </summary>
    protected async Task<T> ExecuteAsync<T>(
        Func<Task<T>> operation,
        string operationName,
        CancellationToken cancellationToken = default)
    {
        try
        {
            Logger.LogDebug("Executing {Operation}", operationName);
            var result = await operation();
            Logger.LogDebug("Completed {Operation} successfully", operationName);
            return result;
        }
        catch (OboAuthenticationException)
        {
            // Re-throw OBO exceptions as-is
            throw;
        }
        catch (AuthenticationFailedException ex)
        {
            Logger.LogWarning(ex, "Authentication failed for {Operation}", operationName);
            throw new OboAuthenticationException(
                $"Authentication failed: {ex.Message}",
                ex);
        }
        catch (RequestFailedException ex) when (ex.Status == 401)
        {
            Logger.LogWarning(ex, "Unauthorized for {Operation}", operationName);
            throw OboAuthenticationException.InvalidGrant(
                "Access token is invalid or expired. Please re-authenticate.",
                ex);
        }
        catch (RequestFailedException ex) when (ex.Status == 403)
        {
            Logger.LogWarning(ex, "Access denied for {Operation}", operationName);
            throw new UnauthorizedAccessException(
                $"Access denied. User does not have permission for this operation. " +
                $"Error: {ex.Message}",
                ex);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            Logger.LogWarning(ex, "Resource not found for {Operation}", operationName);
            throw new KeyNotFoundException(
                $"Resource not found. {ex.Message}",
                ex);
        }
        catch (RequestFailedException ex) when (ex.Status == 429)
        {
            Logger.LogWarning(ex, "Rate limited for {Operation}", operationName);
            throw new InvalidOperationException(
                "Too many requests. Please try again later.",
                ex);
        }
        catch (RequestFailedException ex)
        {
            Logger.LogError(
                ex,
                "Azure request failed for {Operation}. Status: {Status}, Error: {Error}",
                operationName,
                ex.Status,
                ex.ErrorCode);
            throw new InvalidOperationException(
                $"Azure request failed: {ex.Message}",
                ex);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            Logger.LogError(ex, "Unexpected error in {Operation}", operationName);
            throw;
        }
    }

    /// <summary>
    /// Wraps a void async operation with standard error handling.
    /// </summary>
    protected async Task ExecuteAsync(
        Func<Task> operation,
        string operationName,
        CancellationToken cancellationToken = default)
    {
        await ExecuteAsync(async () =>
        {
            await operation();
            return true;
        }, operationName, cancellationToken);
    }

    /// <summary>
    /// Collects all items from an async enumerable into a list.
    /// </summary>
    protected async Task<List<T>> CollectAsync<T>(
        IAsyncEnumerable<T> source,
        CancellationToken cancellationToken = default)
    {
        var items = new List<T>();
        await foreach (var item in source.WithCancellation(cancellationToken))
        {
            items.Add(item);
        }
        return items;
    }

    /// <summary>
    /// Collects items from an async enumerable with a limit.
    /// </summary>
    protected async Task<List<T>> CollectAsync<T>(
        IAsyncEnumerable<T> source,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var items = new List<T>();
        await foreach (var item in source.WithCancellation(cancellationToken))
        {
            items.Add(item);
            if (items.Count >= limit)
                break;
        }
        return items;
    }
}
