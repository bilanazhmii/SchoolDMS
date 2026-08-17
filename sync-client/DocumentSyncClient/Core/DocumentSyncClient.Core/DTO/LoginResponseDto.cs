using System.Text.Json.Serialization;

namespace DocumentSyncClient.Core.DTO;

/// <summary>
/// DTO used for authentication login responses.
/// </summary>
public sealed class LoginResponseDto
{
    /// <summary>
    /// Gets or sets the access token.
    /// </summary>
    [JsonPropertyName("accessToken")]
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the refresh token.
    /// </summary>
    [JsonPropertyName("refreshToken")]
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the token expiration in seconds.
    /// </summary>
    [JsonPropertyName("expiresIn")]
    public int ExpiresIn { get; set; }

    /// <summary>
    /// Gets or sets the user email.
    /// </summary>
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
}
