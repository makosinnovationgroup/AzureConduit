namespace AzureConduit.Mcp.Dataverse.Controllers;

using Microsoft.AspNetCore.Mvc;
using AzureConduit.Mcp.Dataverse.Tools;
using AzureConduit.Mcp.Core.Exceptions;

[ApiController]
[Route("tools")]
public class McpController : ControllerBase
{
    // Record Operations (matches Microsoft's data CRUD pattern)
    [HttpPost("dataverse_record_create")]
    public async Task<IActionResult> CreateRecord([FromServices] CreateRecordTool tool, [FromBody] CreateRecordRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.TableName, r.Data, ct));

    [HttpPost("dataverse_records_list")]
    public async Task<IActionResult> ListRecords([FromServices] ListRecordsTool tool, [FromBody] ListRecordsRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.TableName, r.Select, r.Filter, r.Top ?? 50, ct));

    [HttpPost("dataverse_record_get")]
    public async Task<IActionResult> GetRecord([FromServices] GetRecordTool tool, [FromBody] RecordRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.TableName, r.RecordId, r.Select, ct));

    [HttpPost("dataverse_record_update")]
    public async Task<IActionResult> UpdateRecord([FromServices] UpdateRecordTool tool, [FromBody] UpdateRecordRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.TableName, r.RecordId, r.Data, ct));

    [HttpPost("dataverse_record_delete")]
    public async Task<IActionResult> DeleteRecord([FromServices] DeleteRecordTool tool, [FromBody] DeleteRecordRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.TableName, r.RecordId, ct));

    [HttpPost("dataverse_query")]
    public async Task<IActionResult> Query([FromServices] QueryTool tool, [FromBody] QueryRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.FetchXml, ct));

    [HttpPost("dataverse_search")]
    public async Task<IActionResult> Search([FromServices] SearchTool tool, [FromBody] SearchRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SearchTerm, r.Entities, r.Top ?? 50, ct));

    // Table/Schema Operations (matches Microsoft's schema management pattern)
    [HttpPost("dataverse_tables_list")]
    public async Task<IActionResult> ListTables([FromServices] ListTablesTool tool, [FromBody] ListTablesRequest? r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r?.Search, r?.Top ?? 50, ct));

    [HttpPost("dataverse_table_get")]
    public async Task<IActionResult> GetTable([FromServices] GetTableTool tool, [FromBody] TableRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.TableName, ct));

    [HttpPost("dataverse_table_describe")]
    public async Task<IActionResult> DescribeTable([FromServices] DescribeTableTool tool, [FromBody] TableRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.TableName, ct));

    [HttpPost("dataverse_table_create")]
    public async Task<IActionResult> CreateTable([FromServices] CreateTableTool tool, [FromBody] CreateTableRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SchemaName, r.DisplayName, r.PluralName, r.Description, r.Columns, ct));

    [HttpPost("dataverse_table_update")]
    public async Task<IActionResult> UpdateTable([FromServices] UpdateTableTool tool, [FromBody] UpdateTableRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.TableName, r.DisplayName, r.PluralName, r.Description, ct));

    [HttpPost("dataverse_table_delete")]
    public async Task<IActionResult> DeleteTable([FromServices] DeleteTableTool tool, [FromBody] TableRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.TableName, ct));

    private async Task<IActionResult> Execute<T>(Func<Task<T>> fn)
    {
        try { return Ok(await fn()); }
        catch (OboAuthenticationException ex) { return Unauthorized(new { error = ex.ErrorCode, message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(403, new { error = "access_denied", message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = "not_found", message = ex.Message }); }
    }
}

// Request DTOs
public record ListTablesRequest { public string? Search { get; init; } public int? Top { get; init; } }
public record TableRequest { public required string TableName { get; init; } }
public record ListRecordsRequest { public required string TableName { get; init; } public string? Select { get; init; } public string? Filter { get; init; } public int? Top { get; init; } }
public record RecordRequest { public required string TableName { get; init; } public required string RecordId { get; init; } public string? Select { get; init; } }
public record CreateRecordRequest { public required string TableName { get; init; } public required Dictionary<string, object> Data { get; init; } }
public record UpdateRecordRequest { public required string TableName { get; init; } public required string RecordId { get; init; } public required Dictionary<string, object> Data { get; init; } }
public record DeleteRecordRequest { public required string TableName { get; init; } public required string RecordId { get; init; } }
public record QueryRequest { public required string FetchXml { get; init; } }
public record SearchRequest { public required string SearchTerm { get; init; } public string? Entities { get; init; } public int? Top { get; init; } }
public record CreateTableRequest { public required string SchemaName { get; init; } public required string DisplayName { get; init; } public required string PluralName { get; init; } public string? Description { get; init; } public List<CreateColumnDefinition>? Columns { get; init; } }
public record UpdateTableRequest { public required string TableName { get; init; } public string? DisplayName { get; init; } public string? PluralName { get; init; } public string? Description { get; init; } }
