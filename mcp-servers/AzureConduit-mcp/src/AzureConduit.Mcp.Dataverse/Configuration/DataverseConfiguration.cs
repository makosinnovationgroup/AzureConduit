namespace AzureConduit.Mcp.Dataverse.Configuration;

public class DataverseConfiguration
{
    public const string SectionName = "Dataverse";
    public required string EnvironmentUrl { get; set; }

    public string GetScope() => $"{EnvironmentUrl.TrimEnd('/')}/.default";

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(EnvironmentUrl))
            throw new InvalidOperationException("Dataverse EnvironmentUrl is required");
    }
}
