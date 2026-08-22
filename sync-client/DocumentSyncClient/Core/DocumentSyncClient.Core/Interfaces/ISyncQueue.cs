using DocumentSyncClient.Core.Models;

namespace DocumentSyncClient.Core.Interfaces;

/// <summary>
/// Defines a persistent queue for sync jobs.
/// </summary>
public interface ISyncQueue
{
    /// <summary>
    /// Enqueues a new sync job.
    /// </summary>
    /// <summary>
    /// Enqueues a job and returns false when an identical completed job already covers the same content.
    /// </summary>
    Task<bool> EnqueueAsync(SyncJob job, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves the next eligible job to process.
    /// </summary>
    Task<SyncJob?> DequeueNextAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks a job as completed.
    /// </summary>
    Task CompleteAsync(Guid jobId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks a job as failed and schedules a retry.
    /// </summary>
    Task FailAsync(Guid jobId, string error, CancellationToken cancellationToken = default);
}
