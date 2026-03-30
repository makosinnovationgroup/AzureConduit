using AzureConduit.Mcp.Core.Extensions;
using AzureConduit.Mcp.Dataverse.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddOboAuthentication(builder.Configuration);
builder.Services.AddDataverseMcpTools(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapHealthChecks("/health");
app.MapControllers();

app.MapGet("/", () => Results.Ok(new
{
    server = "AzureConduit Dataverse MCP",
    version = "1.0.0",
    description = "Dataverse MCP Server with OBO authentication for user-scoped access",
    tools = new[]
    {
        "dataverse_tables_list",
        "dataverse_table_get",
        "dataverse_records_list",
        "dataverse_record_get",
        "dataverse_record_create",
        "dataverse_record_update",
        "dataverse_query"
    }
}));

app.Run();
