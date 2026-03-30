namespace AzureConduit.Mcp.Core.Exceptions;

/// <summary>
/// Exception thrown when OBO token exchange fails.
/// </summary>
public class OboAuthenticationException : Exception
{
    /// <summary>
    /// The MSAL error code, if available.
    /// </summary>
    public string? ErrorCode { get; }

    /// <summary>
    /// Claims challenge from the server, if interaction is required.
    /// </summary>
    public string? Claims { get; }

    /// <summary>
    /// Whether the user needs to re-authenticate interactively.
    /// </summary>
    public bool RequiresInteraction { get; }

    public OboAuthenticationException(string message)
        : base(message)
    {
    }

    public OboAuthenticationException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public OboAuthenticationException(
        string message,
        string? errorCode,
        string? claims,
        bool requiresInteraction,
        Exception? innerException = null)
        : base(message, innerException)
    {
        ErrorCode = errorCode;
        Claims = claims;
        RequiresInteraction = requiresInteraction;
    }

    /// <summary>
    /// Creates an exception for when user interaction is required.
    /// </summary>
    public static OboAuthenticationException InteractionRequired(
        string message,
        string? claims = null,
        Exception? innerException = null)
    {
        return new OboAuthenticationException(
            message,
            "interaction_required",
            claims,
            requiresInteraction: true,
            innerException);
    }

    /// <summary>
    /// Creates an exception for invalid or expired tokens.
    /// </summary>
    public static OboAuthenticationException InvalidGrant(
        string message,
        Exception? innerException = null)
    {
        return new OboAuthenticationException(
            message,
            "invalid_grant",
            claims: null,
            requiresInteraction: true,
            innerException);
    }

    /// <summary>
    /// Creates an exception for configuration errors.
    /// </summary>
    public static OboAuthenticationException ConfigurationError(
        string message,
        Exception? innerException = null)
    {
        return new OboAuthenticationException(
            message,
            "configuration_error",
            claims: null,
            requiresInteraction: false,
            innerException);
    }
}
