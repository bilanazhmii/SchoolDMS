namespace DocumentSyncClient.Core.Models;

/// <summary>
/// Represents a single file synchronization action to be processed by the worker.
/// </summary>
public sealed class SyncJob
{
    /// <summary>
    /// Gets or sets the unique identifier of the sync job.
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Gets or sets the full local path affected by the change.
    /// </summary>
    public string FilePath { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the relative path from the watched root.
    /// </summary>
    public string RelativePath { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the type of operation to sync.
    /// </summary>
    public SyncOperationType Operation { get; set; }

    /// <summary>
    /// Gets or sets the SHA256 hash of the file content when available.
    /// </summary>
    public string? Sha256Hash { get; set; }

    /// <summary>
    /// Gets or sets the size of the file in bytes when available.
    /// </summary>
    public long FileSize { get; set; }

    /// <summary>
    /// Gets or sets the number of times the job has been retried.
    /// </summary>
    public int RetryCount { get; set; }

    /// <summary>
    /// Gets or sets the priority of the job.
    /// </summary>
    public SyncPriority Priority { get; set; } = SyncPriority.Normal;

    /// <summary>
    /// Gets or sets the current status of the job.
    /// </summary>
    public SyncJobStatus Status { get; set; } = SyncJobStatus.Pending;

    /// <summary>
    /// Gets or sets the next time this job should be attempted.
    /// </summary>
    public DateTimeOffset? NextAttemptAt { get; set; }

    /// <summary>
    /// Gets or sets the last error that prevented the job from completing.
    /// </summary>
    public string? LastError { get; set; }

    /// <summary>
    /// Gets or sets the timestamp when the job was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Gets or sets the timestamp of the last update.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Gets or sets an optional payload associated with the operation.
    /// </summary>
    public string? Payload { get; set; }
}

/// <summary>
/// Defines the available sync operations for an item.
/// </summary>
public enum SyncOperationType
{
    /// <summary>
    /// Upload a file or folder to the backend.
    /// </summary>
    Create,

    /// <summary>
    /// Update an existing file or directory.
    /// </summary>
    Update,

    /// <summary>
    /// Remove an item from the backend.
    /// </summary>
    Delete,

    /// <summary>
    /// Rename an item in the backend.
    /// </summary>
    Rename,

    /// <summary>
    /// Move an item in the backend.
    /// </summary>
    Move
}
