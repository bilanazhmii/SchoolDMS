using System.Text.Json.Serialization;

namespace DocumentSyncClient.Core.DTO;

/// <summary>
/// DTO used for authentication login requests.
/// </summary>
public sealed class LoginRequestDto
{
    /// <summary>
    /// Gets or sets the user email.
    /// </summary>
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the user password.
    /// </summary>
    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}
