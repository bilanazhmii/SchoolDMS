using System.Text.Json.Serialization;

namespace DocumentSyncClient.Core.DTO;

/// <summary>
/// DTO used for authentication refresh requests.
/// </summary>
public sealed class RefreshTokenRequestDto
{
    /// <summary>
    /// Gets or sets the refresh token.
    /// </summary>
    [JsonPropertyName("refreshToken")]
    public string RefreshToken { get; set; } = string.Empty;
}
