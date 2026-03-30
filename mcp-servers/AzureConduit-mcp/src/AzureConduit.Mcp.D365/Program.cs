using AzureConduit.Mcp.D365.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "AzureConduit D365 MCP", Version = "v1" });
});

builder.Services.AddD365Mcp(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddHealthChecks();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.MapControllers();
app.MapHealthChecks("/health");

app.MapGet("/", () => Results.Ok(new
{
    server = "AzureConduit D365 MCP",
    version = "1.0.0",
    description = "Dynamics 365 F&O MCP Server with OBO authentication (Microsoft-aligned)",
    tools = new
    {
        data = new[] { "d365_data_find_entity_type", "d365_data_get_entity_metadata", "d365_data_find_entities", "d365_data_create_entities", "d365_data_update_entities", "d365_data_delete_entities" },
        action = new[] { "d365_api_find_actions", "d365_api_invoke_action" },
        form = new[] { "d365_form_open_menu_item", "d365_form_find_menu_item", "d365_form_find_controls", "d365_form_set_control_values", "d365_form_click_control", "d365_form_filter_form", "d365_form_filter_grid", "d365_form_select_grid_row", "d365_form_sort_grid_column", "d365_form_open_lookup", "d365_form_open_or_close_tab", "d365_form_save_form", "d365_form_close_form" }
    }
}));

app.Run();
