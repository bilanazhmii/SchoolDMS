namespace DocumentSyncClient.Core.Models;

/// <summary>
/// Represents the priority of a sync job.
/// </summary>
public enum SyncPriority
{
    /// <summary>
    /// Low priority job.
    /// </summary>
    Low = 0,

    /// <summary>
    /// Normal priority job.
    /// </summary>
    Normal = 1,

    /// <summary>
    /// High priority job.
    /// </summary>
    High = 2
}
