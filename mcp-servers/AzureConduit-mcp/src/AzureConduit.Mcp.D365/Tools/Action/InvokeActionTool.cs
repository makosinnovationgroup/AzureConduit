namespace AzureConduit.Mcp.D365.Tools.Action;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Invoke an OData action or function
/// </summary>
public class InvokeActionTool : D365BaseService
{
    public InvokeActionTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<InvokeActionTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    /// <summary>
    /// Invoke an action or function
    /// </summary>
    /// <param name="actionName">Name of the action/function to invoke</param>
    /// <param name="entityName">Entity name if this is a bound action (e.g., "SalesOrders")</param>
    /// <param name="entityKey">Entity key if this is a bound action (e.g., "'SO001'")</param>
    /// <param name="parameters">Parameters to pass to the action</param>
    /// <param name="isFunction">True if this is a function (GET), false if action (POST)</param>
    public async Task<InvokeActionResult> ExecuteAsync(
        string actionName,
        string? entityName = null,
        string? entityKey = null,
        Dictionary<string, object>? parameters = null,
        bool isFunction = false,
        CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateD365ClientAsync(ct);

            string url;
            if (!string.IsNullOrEmpty(entityName) && !string.IsNullOrEmpty(entityKey))
            {
                // Bound action: EntitySet(key)/Namespace.ActionName
                url = $"{entityName}({entityKey})/Microsoft.Dynamics.DataEntities.{actionName}";
            }
            else if (!string.IsNullOrEmpty(entityName))
            {
                // Collection-bound action
                url = $"{entityName}/Microsoft.Dynamics.DataEntities.{actionName}";
            }
            else
            {
                // Unbound action
                url = $"Microsoft.Dynamics.DataEntities.{actionName}";
            }

            HttpResponseMessage response;
            if (isFunction)
            {
                // Functions use GET with parameters in URL
                if (parameters != null && parameters.Count > 0)
                {
                    var paramString = string.Join(",", parameters.Select(p =>
                        $"{p.Key}={FormatParameterValue(p.Value)}"));
                    url += $"({paramString})";
                }
                response = await client.GetAsync(url, ct);
            }
            else
            {
                // Actions use POST with parameters in body
                var json = parameters != null ? JsonSerializer.Serialize(parameters, JsonOptions) : "{}";
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                response = await client.PostAsync(url, content, ct);
            }

            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(ct);
            object? result = null;
            if (!string.IsNullOrWhiteSpace(responseContent))
            {
                try
                {
                    result = JsonSerializer.Deserialize<JsonElement>(responseContent, JsonOptions);
                }
                catch
                {
                    result = responseContent;
                }
            }

            return new InvokeActionResult
            {
                ActionName = actionName,
                Success = true,
                Result = result
            };
        }, "InvokeAction", ct);
    }

    private static string FormatParameterValue(object value)
    {
        return value switch
        {
            string s => $"'{s}'",
            bool b => b.ToString().ToLower(),
            DateTime dt => dt.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            _ => value.ToString() ?? ""
        };
    }
}

public record InvokeActionResult
{
    public required string ActionName { get; init; }
    public bool Success { get; init; }
    public object? Result { get; init; }
}
