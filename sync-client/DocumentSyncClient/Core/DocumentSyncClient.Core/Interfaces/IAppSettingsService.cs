using DocumentSyncClient.Core.Models;

namespace DocumentSyncClient.Core.Interfaces;

/// <summary>
/// Defines persistence operations for application settings.
/// </summary>
public interface IAppSettingsService
{
    /// <summary>
    /// Loads the stored application settings.
    /// </summary>
    Task<AppSettings> LoadAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Saves the application settings.
    /// </summary>
    Task SaveAsync(AppSettings settings, CancellationToken cancellationToken = default);
}
