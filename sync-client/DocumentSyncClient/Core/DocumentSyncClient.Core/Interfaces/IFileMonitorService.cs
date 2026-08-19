namespace DocumentSyncClient.Core.Interfaces;

/// <summary>
/// Defines a service that watches a local folder and transforms filesystem changes into sync jobs.
/// </summary>
public interface IFileMonitorService : IAsyncDisposable
{
    /// <summary>
    /// Starts watching the supplied root folder. Calling again with another
    /// path adds a second watcher so multiple folders can be monitored.
    /// </summary>
    Task StartAsync(string? rootPath = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stops watching the configured root folder.
    /// </summary>
    Task StopAsync(CancellationToken cancellationToken = default);
}
