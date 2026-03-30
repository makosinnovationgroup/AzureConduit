namespace AzureConduit.Mcp.D365.Tools.Action;

using System.Text.Json;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Find custom actions you can invoke via OData
/// </summary>
public class FindActionsTool : D365BaseService
{
    public FindActionsTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<FindActionsTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<FindActionsResult> ExecuteAsync(string? search = null, string? boundToEntity = null, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateD365ClientAsync(ct);

            // Get $metadata XML to find actions and functions
            var response = await client.GetAsync("$metadata", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);
            var doc = XDocument.Parse(content);
            XNamespace edm = "http://docs.oasis-open.org/odata/ns/edm";

            var actions = new List<ActionSummary>();

            // Find all Action definitions
            foreach (var action in doc.Descendants(edm + "Action"))
            {
                var name = action.Attribute("Name")?.Value ?? "";
                var isBound = action.Attribute("IsBound")?.Value == "true";
                var entityBound = "";

                if (isBound)
                {
                    var bindingParam = action.Elements(edm + "Parameter").FirstOrDefault();
                    entityBound = bindingParam?.Attribute("Type")?.Value ?? "";
                }

                // Apply filters
                if (!string.IsNullOrEmpty(search) && !name.Contains(search, StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!string.IsNullOrEmpty(boundToEntity) && !entityBound.Contains(boundToEntity, StringComparison.OrdinalIgnoreCase))
                    continue;

                var parameters = action.Elements(edm + "Parameter")
                    .Skip(isBound ? 1 : 0) // Skip binding parameter
                    .Select(p => new ActionParameter
                    {
                        Name = p.Attribute("Name")?.Value ?? "",
                        Type = p.Attribute("Type")?.Value ?? "",
                        Nullable = p.Attribute("Nullable")?.Value != "false"
                    }).ToList();

                actions.Add(new ActionSummary
                {
                    Name = name,
                    IsBound = isBound,
                    BoundToEntity = entityBound,
                    Parameters = parameters,
                    ReturnType = action.Element(edm + "ReturnType")?.Attribute("Type")?.Value
                });
            }

            // Find all Function definitions
            foreach (var function in doc.Descendants(edm + "Function"))
            {
                var name = function.Attribute("Name")?.Value ?? "";
                var isBound = function.Attribute("IsBound")?.Value == "true";
                var entityBound = "";

                if (isBound)
                {
                    var bindingParam = function.Elements(edm + "Parameter").FirstOrDefault();
                    entityBound = bindingParam?.Attribute("Type")?.Value ?? "";
                }

                if (!string.IsNullOrEmpty(search) && !name.Contains(search, StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!string.IsNullOrEmpty(boundToEntity) && !entityBound.Contains(boundToEntity, StringComparison.OrdinalIgnoreCase))
                    continue;

                var parameters = function.Elements(edm + "Parameter")
                    .Skip(isBound ? 1 : 0)
                    .Select(p => new ActionParameter
                    {
                        Name = p.Attribute("Name")?.Value ?? "",
                        Type = p.Attribute("Type")?.Value ?? "",
                        Nullable = p.Attribute("Nullable")?.Value != "false"
                    }).ToList();

                actions.Add(new ActionSummary
                {
                    Name = name,
                    IsBound = isBound,
                    BoundToEntity = entityBound,
                    Parameters = parameters,
                    ReturnType = function.Element(edm + "ReturnType")?.Attribute("Type")?.Value,
                    IsFunction = true
                });
            }

            return new FindActionsResult { Actions = actions, Count = actions.Count };
        }, "FindActions", ct);
    }
}

public record FindActionsResult
{
    public required List<ActionSummary> Actions { get; init; }
    public int Count { get; init; }
}

public record ActionSummary
{
    public required string Name { get; init; }
    public bool IsBound { get; init; }
    public string BoundToEntity { get; init; } = "";
    public required List<ActionParameter> Parameters { get; init; }
    public string? ReturnType { get; init; }
    public bool IsFunction { get; init; }
}

public record ActionParameter
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public bool Nullable { get; init; }
}
