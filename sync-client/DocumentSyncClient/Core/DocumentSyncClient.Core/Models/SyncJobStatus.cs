namespace DocumentSyncClient.Core.Models;

/// <summary>
/// Represents the lifecycle status of a sync job.
/// </summary>
public enum SyncJobStatus
{
    /// <summary>
    /// The job is pending and ready for processing.
    /// </summary>
    Pending,

    /// <summary>
    /// The job is currently being processed.
    /// </summary>
    Processing,

    /// <summary>
    /// The job completed successfully.
    /// </summary>
    Completed,

    /// <summary>
    /// The job failed and is waiting for retry or manual intervention.
    /// </summary>
    Failed
}
