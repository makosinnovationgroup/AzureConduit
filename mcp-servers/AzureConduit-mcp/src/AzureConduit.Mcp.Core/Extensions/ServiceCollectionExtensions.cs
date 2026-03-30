namespace AzureConduit.Mcp.Core.Extensions;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Core.Http;

/// <summary>
/// Extension methods for registering OBO authentication services.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds OBO authentication services to the DI container.
    /// Configuration is read from the "Obo" section of appsettings.json.
    /// </summary>
    /// <param name="services">The service collection</param>
    /// <param name="configuration">The configuration root</param>
    /// <returns>The service collection for chaining</returns>
    public static IServiceCollection AddOboAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Bind configuration from "Obo" section
        services.Configure<OboConfiguration>(
            configuration.GetSection(OboConfiguration.SectionName));

        // Register core services
        return services.AddOboAuthenticationCore();
    }

    /// <summary>
    /// Adds OBO authentication services with a custom configuration action.
    /// </summary>
    /// <param name="services">The service collection</param>
    /// <param name="configure">Action to configure OBO settings</param>
    /// <returns>The service collection for chaining</returns>
    public static IServiceCollection AddOboAuthentication(
        this IServiceCollection services,
        Action<OboConfiguration> configure)
    {
        services.Configure(configure);
        return services.AddOboAuthenticationCore();
    }

    /// <summary>
    /// Adds OBO authentication services with an existing configuration instance.
    /// </summary>
    /// <param name="services">The service collection</param>
    /// <param name="configuration">The OBO configuration instance</param>
    /// <returns>The service collection for chaining</returns>
    public static IServiceCollection AddOboAuthentication(
        this IServiceCollection services,
        OboConfiguration configuration)
    {
        configuration.Validate();
        services.Configure<OboConfiguration>(config =>
        {
            config.TenantId = configuration.TenantId;
            config.ClientId = configuration.ClientId;
            config.ClientSecret = configuration.ClientSecret;
            config.ClientCertificateThumbprint = configuration.ClientCertificateThumbprint;
            config.ClientCertificatePath = configuration.ClientCertificatePath;
            config.ClientCertificatePassword = configuration.ClientCertificatePassword;
            config.TokenCacheMinutes = configuration.TokenCacheMinutes;
            config.UserTokenHeader = configuration.UserTokenHeader;
            config.CloudInstance = configuration.CloudInstance;
            config.EnableCaching = configuration.EnableCaching;
        });

        return services.AddOboAuthenticationCore();
    }

    private static IServiceCollection AddOboAuthenticationCore(this IServiceCollection services)
    {
        // HTTP context accessor for extracting user tokens
        services.AddHttpContextAccessor();

        // Token cache - singleton for sharing across requests
        services.AddSingleton<OboTokenCache>();

        // User token accessor - scoped to extract token from each request
        services.AddScoped<IUserTokenAccessor, UserTokenAccessor>();

        // OBO credential provider - scoped to create credentials per request
        services.AddScoped<IOboTokenCredentialProvider, OboTokenCredentialProvider>();

        return services;
    }

    /// <summary>
    /// Adds HTTP client factory with default configuration.
    /// </summary>
    public static IServiceCollection AddOboHttpClients(
        this IServiceCollection services)
    {
        services.AddHttpClient();
        return services;
    }

    /// <summary>
    /// Adds a named HTTP client for a specific downstream API.
    /// </summary>
    /// <param name="services">The service collection</param>
    /// <param name="name">The client name (e.g., "D365", "Graph")</param>
    /// <param name="baseAddress">The base URL for the API</param>
    /// <param name="configureClient">Optional additional configuration</param>
    /// <returns>The service collection for chaining</returns>
    public static IServiceCollection AddOboHttpClient(
        this IServiceCollection services,
        string name,
        string baseAddress,
        Action<HttpClient>? configureClient = null)
    {
        services.AddHttpClient(name, client =>
        {
            client.BaseAddress = new Uri(baseAddress);
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            configureClient?.Invoke(client);
        });

        return services;
    }
}
