namespace AzureConduit.Mcp.Fabric.Controllers;

using Microsoft.AspNetCore.Mvc;
using AzureConduit.Mcp.Fabric.Tools;
using AzureConduit.Mcp.Fabric.Tools.Docs;
using AzureConduit.Mcp.Fabric.Tools.OneLake;
using AzureConduit.Mcp.Fabric.Tools.Core;
using AzureConduit.Mcp.Core.Exceptions;

[ApiController]
[Route("tools")]
public class McpController : ControllerBase
{
    // ============ DOCS TOOLS (6 tools) ============

    [HttpPost("fabric_docs_workloads")]
    public async Task<IActionResult> ListWorkloads([FromServices] ListWorkloadsTool tool, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(ct));

    [HttpPost("fabric_docs_workload_api_spec")]
    public async Task<IActionResult> GetWorkloadApiSpec([FromServices] GetWorkloadApiSpecTool tool, [FromBody] WorkloadTypeRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkloadType, ct));

    [HttpPost("fabric_docs_platform_api_spec")]
    public async Task<IActionResult> GetPlatformApiSpec([FromServices] GetPlatformApiSpecTool tool, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(ct));

    [HttpPost("fabric_docs_item_definitions")]
    public async Task<IActionResult> GetItemDefinitions([FromServices] GetItemDefinitionsTool tool, [FromBody] ItemTypeRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.ItemType, ct));

    [HttpPost("fabric_docs_best_practices")]
    public async Task<IActionResult> GetBestPractices([FromServices] GetBestPracticesTool tool, [FromBody] TopicRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.Topic, ct));

    [HttpPost("fabric_docs_api_examples")]
    public async Task<IActionResult> GetApiExamples([FromServices] GetApiExamplesTool tool, [FromBody] ApiExamplesRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkloadType, r.Operation, ct));

    // ============ ONELAKE TOOLS (7 tools) ============

    [HttpPost("fabric_onelake_list_files")]
    public async Task<IActionResult> ListFiles([FromServices] ListFilesTool tool, [FromBody] ListFilesRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceName, r.ItemName, r.Directory, r.Recursive, ct));

    [HttpPost("fabric_onelake_upload_file")]
    public async Task<IActionResult> UploadFile([FromServices] UploadFileTool tool, [FromBody] UploadFileRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceName, r.ItemName, r.FilePath, r.Content, r.Overwrite, ct));

    [HttpPost("fabric_onelake_download_file")]
    public async Task<IActionResult> DownloadFile([FromServices] DownloadFileTool tool, [FromBody] DownloadFileRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceName, r.ItemName, r.FilePath, ct));

    [HttpPost("fabric_onelake_delete_file")]
    public async Task<IActionResult> DeleteFile([FromServices] DeleteFileTool tool, [FromBody] DeleteFileRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceName, r.ItemName, r.FilePath, ct));

    [HttpPost("fabric_onelake_create_directory")]
    public async Task<IActionResult> CreateDirectory([FromServices] CreateDirectoryTool tool, [FromBody] DirectoryRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceName, r.ItemName, r.DirectoryPath, ct));

    [HttpPost("fabric_onelake_delete_directory")]
    public async Task<IActionResult> DeleteDirectory([FromServices] DeleteDirectoryTool tool, [FromBody] DeleteDirectoryRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceName, r.ItemName, r.DirectoryPath, r.Recursive, ct));

    [HttpPost("fabric_onelake_list_tables")]
    public async Task<IActionResult> ListOneLakeTables([FromServices] ListOneLakeTablesTool tool, [FromBody] LakehouseRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.LakehouseId, ct));

    // ============ CORE TOOLS (1 tool) ============

    [HttpPost("fabric_core_create_item")]
    public async Task<IActionResult> CreateItem([FromServices] CreateItemTool tool, [FromBody] CreateItemRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.ItemType, r.DisplayName, r.Description, ct));

    // ============ WORKSPACE TOOLS ============

    [HttpPost("fabric_workspaces_list")]
    public async Task<IActionResult> ListWorkspaces([FromServices] ListWorkspacesTool tool, [FromBody] ListWorkspacesRequest? r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r?.Top ?? 100, r?.ContinuationToken, ct));

    [HttpPost("fabric_workspace_get")]
    public async Task<IActionResult> GetWorkspace([FromServices] GetWorkspaceTool tool, [FromBody] WorkspaceRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, ct));

    [HttpPost("fabric_workspace_create")]
    public async Task<IActionResult> CreateWorkspace([FromServices] CreateWorkspaceTool tool, [FromBody] CreateWorkspaceRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.DisplayName, r.Description, r.CapacityId, ct));

    // ============ LAKEHOUSE TOOLS ============

    [HttpPost("fabric_lakehouses_list")]
    public async Task<IActionResult> ListLakehouses([FromServices] ListLakehousesTool tool, [FromBody] WorkspaceScopedRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.ContinuationToken, ct));

    [HttpPost("fabric_lakehouse_get")]
    public async Task<IActionResult> GetLakehouse([FromServices] GetLakehouseTool tool, [FromBody] LakehouseRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.LakehouseId, ct));

    [HttpPost("fabric_lakehouse_tables_list")]
    public async Task<IActionResult> ListLakehouseTables([FromServices] ListLakehouseTablesTool tool, [FromBody] LakehouseTablesRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.LakehouseId, r.ContinuationToken, ct));

    // ============ WAREHOUSE TOOLS ============

    [HttpPost("fabric_warehouses_list")]
    public async Task<IActionResult> ListWarehouses([FromServices] ListWarehousesTool tool, [FromBody] WorkspaceScopedRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.ContinuationToken, ct));

    [HttpPost("fabric_warehouse_get")]
    public async Task<IActionResult> GetWarehouse([FromServices] GetWarehouseTool tool, [FromBody] WarehouseRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.WarehouseId, ct));

    // ============ NOTEBOOK TOOLS ============

    [HttpPost("fabric_notebooks_list")]
    public async Task<IActionResult> ListNotebooks([FromServices] ListNotebooksTool tool, [FromBody] WorkspaceScopedRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.ContinuationToken, ct));

    [HttpPost("fabric_notebook_get")]
    public async Task<IActionResult> GetNotebook([FromServices] GetNotebookTool tool, [FromBody] NotebookRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.NotebookId, ct));

    // ============ PIPELINE TOOLS ============

    [HttpPost("fabric_pipelines_list")]
    public async Task<IActionResult> ListPipelines([FromServices] ListPipelinesTool tool, [FromBody] WorkspaceScopedRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.ContinuationToken, ct));

    [HttpPost("fabric_pipeline_get")]
    public async Task<IActionResult> GetPipeline([FromServices] GetPipelineTool tool, [FromBody] PipelineRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.PipelineId, ct));

    [HttpPost("fabric_pipeline_run")]
    public async Task<IActionResult> RunPipeline([FromServices] RunPipelineTool tool, [FromBody] RunPipelineRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.PipelineId, r.Parameters, ct));

    [HttpPost("fabric_pipeline_run_get")]
    public async Task<IActionResult> GetPipelineRun([FromServices] GetPipelineRunTool tool, [FromBody] GetPipelineRunRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.WorkspaceId, r.PipelineId, r.RunId, ct));

    private async Task<IActionResult> Execute<T>(Func<Task<T>> fn)
    {
        try { return Ok(await fn()); }
        catch (OboAuthenticationException ex) { return Unauthorized(new { error = ex.ErrorCode, message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(403, new { error = "access_denied", message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = "not_found", message = ex.Message }); }
    }
}

// ============ DOCS REQUEST DTOs ============
public record WorkloadTypeRequest { public required string WorkloadType { get; init; } }
public record ItemTypeRequest { public required string ItemType { get; init; } }
public record TopicRequest { public required string Topic { get; init; } }
public record ApiExamplesRequest { public required string WorkloadType { get; init; } public required string Operation { get; init; } }

// ============ ONELAKE REQUEST DTOs ============
public record ListFilesRequest { public required string WorkspaceName { get; init; } public required string ItemName { get; init; } public string? Directory { get; init; } public bool Recursive { get; init; } }
public record UploadFileRequest { public required string WorkspaceName { get; init; } public required string ItemName { get; init; } public required string FilePath { get; init; } public required string Content { get; init; } public bool Overwrite { get; init; } }
public record DownloadFileRequest { public required string WorkspaceName { get; init; } public required string ItemName { get; init; } public required string FilePath { get; init; } }
public record DeleteFileRequest { public required string WorkspaceName { get; init; } public required string ItemName { get; init; } public required string FilePath { get; init; } }
public record DirectoryRequest { public required string WorkspaceName { get; init; } public required string ItemName { get; init; } public required string DirectoryPath { get; init; } }
public record DeleteDirectoryRequest { public required string WorkspaceName { get; init; } public required string ItemName { get; init; } public required string DirectoryPath { get; init; } public bool Recursive { get; init; } }

// ============ CORE REQUEST DTOs ============
public record CreateItemRequest { public required string WorkspaceId { get; init; } public required string ItemType { get; init; } public required string DisplayName { get; init; } public string? Description { get; init; } }

// ============ EXISTING REQUEST DTOs ============
public record ListWorkspacesRequest { public int? Top { get; init; } public string? ContinuationToken { get; init; } }
public record WorkspaceRequest { public required string WorkspaceId { get; init; } }
public record CreateWorkspaceRequest { public required string DisplayName { get; init; } public string? Description { get; init; } public string? CapacityId { get; init; } }
public record WorkspaceScopedRequest { public required string WorkspaceId { get; init; } public string? ContinuationToken { get; init; } }
public record LakehouseRequest { public required string WorkspaceId { get; init; } public required string LakehouseId { get; init; } }
public record LakehouseTablesRequest { public required string WorkspaceId { get; init; } public required string LakehouseId { get; init; } public string? ContinuationToken { get; init; } }
public record WarehouseRequest { public required string WorkspaceId { get; init; } public required string WarehouseId { get; init; } }
public record NotebookRequest { public required string WorkspaceId { get; init; } public required string NotebookId { get; init; } }
public record PipelineRequest { public required string WorkspaceId { get; init; } public required string PipelineId { get; init; } }
public record RunPipelineRequest { public required string WorkspaceId { get; init; } public required string PipelineId { get; init; } public Dictionary<string, object>? Parameters { get; init; } }
public record GetPipelineRunRequest { public required string WorkspaceId { get; init; } public required string PipelineId { get; init; } public required string RunId { get; init; } }
