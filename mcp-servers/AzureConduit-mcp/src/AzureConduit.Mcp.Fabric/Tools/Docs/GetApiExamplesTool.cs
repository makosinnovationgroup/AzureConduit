namespace AzureConduit.Mcp.Fabric.Tools.Docs;

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using AzureConduit.Mcp.Core.Auth;
using AzureConduit.Mcp.Fabric.Configuration;
using AzureConduit.Mcp.Fabric.Services;

/// <summary>
/// Retrieve example API request/response files for workloads
/// </summary>
public class GetApiExamplesTool : FabricBaseService
{
    public GetApiExamplesTool(IOboTokenCredentialProvider credentialProvider, IOptions<FabricConfiguration> config,
        IHttpClientFactory httpClientFactory, ILogger<GetApiExamplesTool> logger)
        : base(credentialProvider, config, httpClientFactory, logger) { }

    public Task<ApiExamplesResult> ExecuteAsync(string workloadType, string operation, CancellationToken ct = default)
    {
        var examples = (workloadType.ToLower(), operation.ToLower()) switch
        {
            ("lakehouse", "create") => GetLakehouseCreateExample(),
            ("lakehouse", "list") => GetLakehouseListExample(),
            ("warehouse", "create") => GetWarehouseCreateExample(),
            ("notebook", "create") => GetNotebookCreateExample(),
            ("pipeline", "run") or ("datapipeline", "run") => GetPipelineRunExample(),
            _ => GetGenericExample(workloadType, operation)
        };

        return Task.FromResult(examples);
    }

    private static ApiExamplesResult GetLakehouseCreateExample() => new()
    {
        WorkloadType = "Lakehouse",
        Operation = "Create",
        Request = new ApiExample
        {
            Method = "POST",
            Url = "/v1/workspaces/{workspaceId}/lakehouses",
            Headers = new Dictionary<string, string> { ["Content-Type"] = "application/json" },
            Body = "{\n  \"displayName\": \"SalesLakehouse\",\n  \"description\": \"Lakehouse for sales data\"\n}"
        },
        Response = new ApiExample
        {
            StatusCode = 201,
            Body = "{\n  \"id\": \"3546052c-ae64-4526-b1a8-52af7761426f\",\n  \"displayName\": \"SalesLakehouse\",\n  \"description\": \"Lakehouse for sales data\",\n  \"workspaceId\": \"cfafbeb1-8037-4d0c-896e-a46fb27ff229\",\n  \"properties\": {\n    \"oneLakeTablesPath\": \"https://onelake.dfs.fabric.microsoft.com/...\",\n    \"oneLakeFilesPath\": \"https://onelake.dfs.fabric.microsoft.com/...\"\n  }\n}"
        }
    };

    private static ApiExamplesResult GetLakehouseListExample() => new()
    {
        WorkloadType = "Lakehouse",
        Operation = "List",
        Request = new ApiExample
        {
            Method = "GET",
            Url = "/v1/workspaces/{workspaceId}/lakehouses"
        },
        Response = new ApiExample
        {
            StatusCode = 200,
            Body = "{\n  \"value\": [\n    {\n      \"id\": \"3546052c-ae64-4526-b1a8-52af7761426f\",\n      \"displayName\": \"SalesLakehouse\",\n      \"workspaceId\": \"cfafbeb1-8037-4d0c-896e-a46fb27ff229\"\n    }\n  ]\n}"
        }
    };

    private static ApiExamplesResult GetWarehouseCreateExample() => new()
    {
        WorkloadType = "Warehouse",
        Operation = "Create",
        Request = new ApiExample
        {
            Method = "POST",
            Url = "/v1/workspaces/{workspaceId}/warehouses",
            Headers = new Dictionary<string, string> { ["Content-Type"] = "application/json" },
            Body = "{\n  \"displayName\": \"SalesWarehouse\",\n  \"description\": \"Data warehouse for sales analytics\"\n}"
        },
        Response = new ApiExample
        {
            StatusCode = 201,
            Body = "{\n  \"id\": \"5678-...\",\n  \"displayName\": \"SalesWarehouse\",\n  \"workspaceId\": \"...\",\n  \"properties\": {\n    \"connectionString\": \"...\"\n  }\n}"
        }
    };

    private static ApiExamplesResult GetNotebookCreateExample() => new()
    {
        WorkloadType = "Notebook",
        Operation = "Create",
        Request = new ApiExample
        {
            Method = "POST",
            Url = "/v1/workspaces/{workspaceId}/notebooks",
            Headers = new Dictionary<string, string> { ["Content-Type"] = "application/json" },
            Body = "{\n  \"displayName\": \"DataProcessing\",\n  \"description\": \"Notebook for data processing\"\n}"
        },
        Response = new ApiExample
        {
            StatusCode = 201,
            Body = "{\n  \"id\": \"...\",\n  \"displayName\": \"DataProcessing\",\n  \"workspaceId\": \"...\"\n}"
        }
    };

    private static ApiExamplesResult GetPipelineRunExample() => new()
    {
        WorkloadType = "DataPipeline",
        Operation = "Run",
        Request = new ApiExample
        {
            Method = "POST",
            Url = "/v1/workspaces/{workspaceId}/items/{pipelineId}/jobs/instances?jobType=Pipeline",
            Headers = new Dictionary<string, string> { ["Content-Type"] = "application/json" },
            Body = "{\n  \"executionData\": {\n    \"parameters\": {\n      \"param1\": \"value1\"\n    }\n  }\n}"
        },
        Response = new ApiExample
        {
            StatusCode = 202,
            Body = "{\n  \"id\": \"job-instance-id\"\n}"
        }
    };

    private static ApiExamplesResult GetGenericExample(string workloadType, string operation) => new()
    {
        WorkloadType = workloadType,
        Operation = operation,
        Request = new ApiExample
        {
            Method = operation.ToLower() == "list" || operation.ToLower() == "get" ? "GET" : "POST",
            Url = $"/v1/workspaces/{{workspaceId}}/{workloadType.ToLower()}s"
        },
        Response = new ApiExample
        {
            StatusCode = 200,
            Body = "{ \"value\": [] }"
        }
    };
}

public record ApiExamplesResult
{
    public required string WorkloadType { get; init; }
    public required string Operation { get; init; }
    public required ApiExample Request { get; init; }
    public required ApiExample Response { get; init; }
}

public record ApiExample
{
    public string? Method { get; init; }
    public string? Url { get; init; }
    public int? StatusCode { get; init; }
    public Dictionary<string, string>? Headers { get; init; }
    public string? Body { get; init; }
}
