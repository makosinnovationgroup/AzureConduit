using AzureConduit.Mcp.Core.Extensions;
using AzureConduit.Mcp.Azure.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Configure logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

// Add OBO authentication (from Core module)
builder.Services.AddOboAuthentication(builder.Configuration);

// Add Azure MCP tools
builder.Services.AddAzureMcpTools();

// Add controllers for MCP endpoints
builder.Services.AddControllers();

// Add health checks
builder.Services.AddHealthChecks();

var app = builder.Build();

// Health check endpoint
app.MapHealthChecks("/health");

// MCP tool endpoints
app.MapControllers();

// Root endpoint with server info
app.MapGet("/", () => Results.Ok(new
{
    server = "AzureConduit Azure MCP",
    version = "1.0.0",
    description = "Azure MCP Server with OBO authentication for user-scoped access",
    tools = new[]
    {
        "azure_subscriptions_list",
        "azure_subscriptions_get",
        "azure_resource_groups_list",
        "azure_resource_groups_get",
        "azure_resource_groups_create",
        "azure_resources_list",
        "azure_storage_accounts_list",
        "azure_storage_containers_list",
        "azure_keyvault_secrets_list",
        "azure_keyvault_secret_get",
        "azure_compute_vms_list",
        "azure_compute_vm_get"
    }
}));

app.Run();
