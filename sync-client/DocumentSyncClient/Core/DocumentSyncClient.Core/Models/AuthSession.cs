namespace DocumentSyncClient.Core.Models;

/// <summary>
/// Represents the authentication state of the current user.
/// </summary>
public sealed class AuthSession
{
    /// <summary>
    /// Gets or sets the access token.
    /// </summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the refresh token.
    /// </summary>
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the token expiration time.
    /// </summary>
    public DateTimeOffset ExpiresAt { get; set; }

    /// <summary>
    /// Gets or sets the current user email.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets a value indicating whether the session is authenticated.
    /// </summary>
    public bool IsAuthenticated => !string.IsNullOrWhiteSpace(AccessToken);
}
