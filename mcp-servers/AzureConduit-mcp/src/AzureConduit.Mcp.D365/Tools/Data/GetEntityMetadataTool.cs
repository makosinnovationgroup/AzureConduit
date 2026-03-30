namespace AzureConduit.Mcp.D365.Tools.Data;

using System.Text.Json;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.D365.Configuration;
using AzureConduit.Mcp.D365.Services;

/// <summary>
/// Get metadata for an OData entity including properties and navigation properties
/// </summary>
public class GetEntityMetadataTool : D365BaseService
{
    public GetEntityMetadataTool(IOboTokenCredentialProvider credentialProvider, IOptions<D365Configuration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetEntityMetadataTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public async Task<EntityMetadataResult> ExecuteAsync(string entityName, CancellationToken ct = default)
    {
        return await ExecuteAsync(async () =>
        {
            using var client = await CreateD365ClientAsync(ct);

            // Get $metadata XML
            var response = await client.GetAsync("$metadata", ct);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(ct);

            // Parse the EDMX metadata
            var doc = XDocument.Parse(content);
            XNamespace edmx = "http://docs.oasis-open.org/odata/ns/edmx";
            XNamespace edm = "http://docs.oasis-open.org/odata/ns/edm";

            var properties = new List<EntityProperty>();
            var navigationProperties = new List<NavigationProperty>();

            // Find the entity type definition
            var entityType = doc.Descendants(edm + "EntityType")
                .FirstOrDefault(e => e.Attribute("Name")?.Value.Equals(entityName, StringComparison.OrdinalIgnoreCase) == true);

            if (entityType != null)
            {
                // Get key properties
                var keyProps = entityType.Element(edm + "Key")?
                    .Elements(edm + "PropertyRef")
                    .Select(p => p.Attribute("Name")?.Value ?? "")
                    .ToHashSet() ?? new HashSet<string>();

                // Get properties
                foreach (var prop in entityType.Elements(edm + "Property"))
                {
                    var propName = prop.Attribute("Name")?.Value ?? "";
                    properties.Add(new EntityProperty
                    {
                        Name = propName,
                        Type = prop.Attribute("Type")?.Value ?? "Unknown",
                        Nullable = prop.Attribute("Nullable")?.Value != "false",
                        IsKey = keyProps.Contains(propName)
                    });
                }

                // Get navigation properties
                foreach (var nav in entityType.Elements(edm + "NavigationProperty"))
                {
                    navigationProperties.Add(new NavigationProperty
                    {
                        Name = nav.Attribute("Name")?.Value ?? "",
                        Type = nav.Attribute("Type")?.Value ?? "",
                        Partner = nav.Attribute("Partner")?.Value
                    });
                }
            }

            return new EntityMetadataResult
            {
                EntityName = entityName,
                Properties = properties,
                NavigationProperties = navigationProperties
            };
        }, "GetEntityMetadata", ct);
    }
}

public record EntityMetadataResult
{
    public required string EntityName { get; init; }
    public required List<EntityProperty> Properties { get; init; }
    public required List<NavigationProperty> NavigationProperties { get; init; }
}

public record EntityProperty
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public bool Nullable { get; init; }
    public bool IsKey { get; init; }
}

public record NavigationProperty
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public string? Partner { get; init; }
}
