namespace AzureConduit.Mcp.D365.Controllers;

using Microsoft.AspNetCore.Mvc;
using AzureConduit.Mcp.Core.Exceptions;
using AzureConduit.Mcp.D365.Tools.Data;
using AzureConduit.Mcp.D365.Tools.Action;
using AzureConduit.Mcp.D365.Tools.Form;

[ApiController]
[Route("tools")]
public class McpController : ControllerBase
{
    // ============ DATA TOOLS (6 tools) ============

    [HttpPost("d365_data_find_entity_type")]
    public async Task<IActionResult> FindEntityType([FromServices] FindEntityTypeTool tool, [FromBody] FindEntityTypeRequest? r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r?.Search, r?.Top ?? 50, ct));

    [HttpPost("d365_data_get_entity_metadata")]
    public async Task<IActionResult> GetEntityMetadata([FromServices] GetEntityMetadataTool tool, [FromBody] EntityNameRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.EntityName, ct));

    [HttpPost("d365_data_find_entities")]
    public async Task<IActionResult> FindEntities([FromServices] FindEntitiesTool tool, [FromBody] FindEntitiesRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.EntityName, r.Select, r.Filter, r.OrderBy, r.Expand, r.Top ?? 50, r.Skip ?? 0, ct));

    [HttpPost("d365_data_create_entities")]
    public async Task<IActionResult> CreateEntities([FromServices] CreateEntitiesTool tool, [FromBody] CreateEntityRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.EntityName, r.Data, ct));

    [HttpPost("d365_data_update_entities")]
    public async Task<IActionResult> UpdateEntities([FromServices] UpdateEntitiesTool tool, [FromBody] UpdateEntityRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.EntityName, r.EntityKey, r.Data, ct));

    [HttpPost("d365_data_delete_entities")]
    public async Task<IActionResult> DeleteEntities([FromServices] DeleteEntitiesTool tool, [FromBody] DeleteEntityRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.EntityName, r.EntityKey, ct));

    // ============ ACTION TOOLS (2 tools) ============

    [HttpPost("d365_api_find_actions")]
    public async Task<IActionResult> FindActions([FromServices] FindActionsTool tool, [FromBody] FindActionsRequest? r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r?.Search, r?.BoundToEntity, ct));

    [HttpPost("d365_api_invoke_action")]
    public async Task<IActionResult> InvokeAction([FromServices] InvokeActionTool tool, [FromBody] InvokeActionRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.ActionName, r.EntityName, r.EntityKey, r.Parameters, r.IsFunction, ct));

    // ============ FORM TOOLS (13 tools) ============

    [HttpPost("d365_form_open_menu_item")]
    public async Task<IActionResult> OpenMenuItem([FromServices] OpenMenuItemTool tool, [FromBody] OpenMenuItemRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.MenuItemName, r.Company, r.Args, ct));

    [HttpPost("d365_form_find_menu_item")]
    public async Task<IActionResult> FindMenuItem([FromServices] FindMenuItemTool tool, [FromBody] SearchRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.Search, r.Top ?? 20, ct));

    [HttpPost("d365_form_find_controls")]
    public async Task<IActionResult> FindControls([FromServices] FindControlsTool tool, [FromBody] FindControlsRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.Search, r.ControlType, ct));

    [HttpPost("d365_form_set_control_values")]
    public async Task<IActionResult> SetControlValues([FromServices] SetControlValuesTool tool, [FromBody] SetControlValuesRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.Values, ct));

    [HttpPost("d365_form_click_control")]
    public async Task<IActionResult> ClickControl([FromServices] ClickControlTool tool, [FromBody] ClickControlRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.ControlName, ct));

    [HttpPost("d365_form_filter_form")]
    public async Task<IActionResult> FilterForm([FromServices] FilterFormTool tool, [FromBody] FilterFormRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.FilterExpression, ct));

    [HttpPost("d365_form_filter_grid")]
    public async Task<IActionResult> FilterGrid([FromServices] FilterGridTool tool, [FromBody] FilterGridRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.GridName, r.ColumnName, r.FilterValue, ct));

    [HttpPost("d365_form_select_grid_row")]
    public async Task<IActionResult> SelectGridRow([FromServices] SelectGridRowTool tool, [FromBody] SelectGridRowRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.GridName, r.RowIndex, ct));

    [HttpPost("d365_form_sort_grid_column")]
    public async Task<IActionResult> SortGridColumn([FromServices] SortGridColumnTool tool, [FromBody] SortGridColumnRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.GridName, r.ColumnName, r.Descending, ct));

    [HttpPost("d365_form_open_lookup")]
    public async Task<IActionResult> OpenLookup([FromServices] OpenLookupTool tool, [FromBody] OpenLookupRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.ControlName, ct));

    [HttpPost("d365_form_open_or_close_tab")]
    public async Task<IActionResult> OpenOrCloseTab([FromServices] OpenOrCloseTabTool tool, [FromBody] OpenOrCloseTabRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.TabName, r.Expand, ct));

    [HttpPost("d365_form_save_form")]
    public async Task<IActionResult> SaveForm([FromServices] SaveFormTool tool, [FromBody] SessionRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, ct));

    [HttpPost("d365_form_close_form")]
    public async Task<IActionResult> CloseForm([FromServices] CloseFormTool tool, [FromBody] CloseFormRequest r, CancellationToken ct)
        => await Execute(() => tool.ExecuteAsync(r.SessionId, r.SaveBeforeClose, ct));

    private async Task<IActionResult> Execute<T>(Func<Task<T>> fn)
    {
        try { return Ok(await fn()); }
        catch (OboAuthenticationException ex) { return Unauthorized(new { error = ex.ErrorCode, message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return StatusCode(403, new { error = "access_denied", message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = "not_found", message = ex.Message }); }
    }
}

// ============ DATA REQUEST DTOs ============
public record FindEntityTypeRequest { public string? Search { get; init; } public int? Top { get; init; } }
public record EntityNameRequest { public required string EntityName { get; init; } }
public record FindEntitiesRequest { public required string EntityName { get; init; } public string? Select { get; init; } public string? Filter { get; init; } public string? OrderBy { get; init; } public string? Expand { get; init; } public int? Top { get; init; } public int? Skip { get; init; } }
public record CreateEntityRequest { public required string EntityName { get; init; } public required Dictionary<string, object> Data { get; init; } }
public record UpdateEntityRequest { public required string EntityName { get; init; } public required string EntityKey { get; init; } public required Dictionary<string, object> Data { get; init; } }
public record DeleteEntityRequest { public required string EntityName { get; init; } public required string EntityKey { get; init; } }

// ============ ACTION REQUEST DTOs ============
public record FindActionsRequest { public string? Search { get; init; } public string? BoundToEntity { get; init; } }
public record InvokeActionRequest { public required string ActionName { get; init; } public string? EntityName { get; init; } public string? EntityKey { get; init; } public Dictionary<string, object>? Parameters { get; init; } public bool IsFunction { get; init; } }

// ============ FORM REQUEST DTOs ============
public record SessionRequest { public required string SessionId { get; init; } }
public record SearchRequest { public required string Search { get; init; } public int? Top { get; init; } }
public record OpenMenuItemRequest { public required string MenuItemName { get; init; } public string? Company { get; init; } public Dictionary<string, string>? Args { get; init; } }
public record FindControlsRequest { public required string SessionId { get; init; } public string? Search { get; init; } public string? ControlType { get; init; } }
public record SetControlValuesRequest { public required string SessionId { get; init; } public required Dictionary<string, object> Values { get; init; } }
public record ClickControlRequest { public required string SessionId { get; init; } public required string ControlName { get; init; } }
public record FilterFormRequest { public required string SessionId { get; init; } public required string FilterExpression { get; init; } }
public record FilterGridRequest { public required string SessionId { get; init; } public required string GridName { get; init; } public required string ColumnName { get; init; } public required string FilterValue { get; init; } }
public record SelectGridRowRequest { public required string SessionId { get; init; } public required string GridName { get; init; } public int RowIndex { get; init; } }
public record SortGridColumnRequest { public required string SessionId { get; init; } public required string GridName { get; init; } public required string ColumnName { get; init; } public bool Descending { get; init; } }
public record OpenLookupRequest { public required string SessionId { get; init; } public required string ControlName { get; init; } }
public record OpenOrCloseTabRequest { public required string SessionId { get; init; } public required string TabName { get; init; } public bool Expand { get; init; } = true; }
public record CloseFormRequest { public required string SessionId { get; init; } public bool SaveBeforeClose { get; init; } }
