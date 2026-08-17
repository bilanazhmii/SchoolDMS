using DocumentSyncClient.Core.DTO;

namespace DocumentSyncClient.Core.Interfaces;

/// <summary>
/// Defines authentication operations used by the client.
/// </summary>
public interface IAuthenticationService
{
    /// <summary>
    /// Attempts to sign in the user with the supplied credentials.
    /// </summary>
    Task<LoginResponseDto?> SignInAsync(LoginRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Refreshes the current authentication session.
    /// </summary>
    Task<LoginResponseDto?> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);

    /// <summary>
    /// Signs the user out and clears the cached session.
    /// </summary>
    Task SignOutAsync(CancellationToken cancellationToken = default);
}
