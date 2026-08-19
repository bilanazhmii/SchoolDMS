using DocumentSyncClient.Core.Models;

namespace DocumentSyncClient.Core.Interfaces;

/// <summary>
/// Defines the sync engine contract for processing pending sync work.
/// </summary>
public interface ISyncEngine
{
    /// <summary>
    /// Starts the background sync processing loop.
    /// </summary>
    Task StartAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Stops the background sync processing loop.
    /// </summary>
    Task StopAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Queues a local file change for synchronization.
    /// </summary>
    Task QueueFileChangeAsync(string path, SyncOperationType operation, string? payload = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Enqueues every file under a folder for upload (initial folder sync).
    /// </summary>
    Task SyncFolderAsync(string rootPath, CancellationToken cancellationToken = default);

    /// <summary>
    /// Raised after a job is completed or failed (for live UI indicators).
    /// </summary>
    event Action<SyncJob, bool>? JobProcessed;

    /// <summary>
    /// Registers this device with the backend heartbeat so the web dashboard
    /// can show the client as online.
    /// </summary>
    Task RegisterDeviceAsync(CancellationToken cancellationToken = default);
}
