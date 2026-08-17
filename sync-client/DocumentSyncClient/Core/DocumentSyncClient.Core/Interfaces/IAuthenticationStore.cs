using DocumentSyncClient.Core.Models;

namespace DocumentSyncClient.Core.Interfaces;

/// <summary>
/// Stores authentication details for the current user.
/// </summary>
public interface IAuthenticationStore
{
    /// <summary>
    /// Loads the stored authentication session.
    /// </summary>
    Task<AuthSession?> LoadAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Saves the authentication session.
    /// </summary>
    Task SaveAsync(AuthSession session, CancellationToken cancellationToken = default);

    /// <summary>
    /// Clears the stored authentication session.
    /// </summary>
    Task ClearAsync(CancellationToken cancellationToken = default);
}
