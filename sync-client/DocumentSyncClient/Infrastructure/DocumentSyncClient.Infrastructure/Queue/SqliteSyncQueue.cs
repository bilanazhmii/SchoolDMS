using System.Data;
using System.Data.Common;
using System.Data.SQLite;
using System.Security.Cryptography;
using DocumentSyncClient.Core.Interfaces;
using DocumentSyncClient.Core.Models;
using Microsoft.Extensions.Logging;

namespace DocumentSyncClient.Infrastructure.Queue;

/// <summary>
/// SQLite-backed implementation of the sync queue with durable persistence and basic deduplication.
/// </summary>
public sealed class SqliteSyncQueue : ISyncQueue, IAsyncDisposable
{
    private readonly string _databasePath;
    private readonly ILogger<SqliteSyncQueue> _logger;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly HashSet<string> _ignoreList = new(StringComparer.OrdinalIgnoreCase)
    {
        "node_modules",
        ".git",
        "bin",
        "obj",
        "thumbs.db",
        "desktop.ini",
        ".vs"
    };

    /// <summary>
    /// Initializes a new instance of the <see cref="SqliteSyncQueue"/> class.
    /// </summary>
    public SqliteSyncQueue(ILogger<SqliteSyncQueue> logger)
    {
        _logger = logger;
        var appDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DocumentSyncClient");
        Directory.CreateDirectory(appDataFolder);
        _databasePath = Path.Combine(appDataFolder, "sync-queue.sqlite");
        InitializeDatabase().GetAwaiter().GetResult();
    }

    /// <inheritdoc />
    public async Task EnqueueAsync(SyncJob job, CancellationToken cancellationToken = default)
    {
        if (ShouldIgnore(job.FilePath))
        {
            return;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            PopulateMetadata(job);
            await EnsureDeduplicationAsync(job, cancellationToken);
            await PersistJobAsync(job, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <inheritdoc />
    public async Task<SyncJob?> DequeueNextAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await using var connection = CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var transaction = connection.BeginTransaction(IsolationLevel.Serializable);
            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = @"
                SELECT Id, FilePath, RelativePath, Operation, Sha256Hash, FileSize, RetryCount, Priority, Status, NextAttemptAt, LastError, CreatedAt, UpdatedAt, Payload
                FROM SyncJobs
                WHERE Status IN (@pending, @failed) AND (NextAttemptAt IS NULL OR NextAttemptAt <= @now)
                ORDER BY Priority DESC, CreatedAt ASC
                LIMIT 1;";
            command.Parameters.AddWithValue("@pending", (int)SyncJobStatus.Pending);
            command.Parameters.AddWithValue("@failed", (int)SyncJobStatus.Failed);
            command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                await transaction.CommitAsync(cancellationToken);
                return null;
            }

            var pendingJob = MapReader(reader);
            pendingJob.Status = SyncJobStatus.Processing;
            pendingJob.UpdatedAt = DateTimeOffset.UtcNow;
            await UpdateJobAsync(connection, pendingJob, transaction, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return pendingJob;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <inheritdoc />
    public async Task CompleteAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await using var connection = CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var transaction = connection.BeginTransaction(IsolationLevel.Serializable);
            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = @"
                UPDATE SyncJobs
                SET Status = @completed,
                    UpdatedAt = @updatedAt,
                    LastError = NULL
                WHERE Id = @id;";
            command.Parameters.AddWithValue("@completed", (int)SyncJobStatus.Completed);
            command.Parameters.AddWithValue("@updatedAt", DateTimeOffset.UtcNow);
            command.Parameters.AddWithValue("@id", jobId.ToString());
            await command.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <inheritdoc />
    public async Task FailAsync(Guid jobId, string error, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            await using var connection = CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var transaction = connection.BeginTransaction(IsolationLevel.Serializable);

            var retryCommand = connection.CreateCommand();
            retryCommand.Transaction = transaction;
            retryCommand.CommandText = "SELECT RetryCount FROM SyncJobs WHERE Id = @id;";
            retryCommand.Parameters.AddWithValue("@id", jobId.ToString());
            var retryValue = await retryCommand.ExecuteScalarAsync(cancellationToken);
            var retryCount = retryValue is null || retryValue == DBNull.Value ? 1 : Convert.ToInt32(retryValue) + 1;
            var delaySeconds = Math.Min(300, Math.Pow(2, Math.Min(retryCount + 1, 8)));
            var nextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(delaySeconds);

            var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = @"
                UPDATE SyncJobs
                SET Status = @failed,
                    RetryCount = @retryCount,
                    LastError = @error,
                    NextAttemptAt = @nextAttemptAt,
                    UpdatedAt = @updatedAt
                WHERE Id = @id;";
            command.Parameters.AddWithValue("@failed", (int)SyncJobStatus.Failed);
            command.Parameters.AddWithValue("@retryCount", retryCount);
            command.Parameters.AddWithValue("@error", error);
            command.Parameters.AddWithValue("@nextAttemptAt", nextAttemptAt);
            command.Parameters.AddWithValue("@updatedAt", DateTimeOffset.UtcNow);
            command.Parameters.AddWithValue("@id", jobId.ToString());
            await command.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        _gate.Dispose();
        await Task.CompletedTask;
    }

    private async Task InitializeDatabase()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        var command = connection.CreateCommand();
        command.CommandText = @"
            CREATE TABLE IF NOT EXISTS SyncJobs (
                Id TEXT PRIMARY KEY,
                FilePath TEXT NOT NULL,
                RelativePath TEXT NOT NULL,
                Operation INTEGER NOT NULL,
                Sha256Hash TEXT,
                FileSize INTEGER NOT NULL,
                RetryCount INTEGER NOT NULL DEFAULT 0,
                Priority INTEGER NOT NULL DEFAULT 1,
                Status INTEGER NOT NULL DEFAULT 0,
                NextAttemptAt TEXT,
                LastError TEXT,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL,
                Payload TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_syncjobs_status_created ON SyncJobs(Status, CreatedAt);
            CREATE INDEX IF NOT EXISTS idx_syncjobs_path ON SyncJobs(FilePath);
        ";
        await command.ExecuteNonQueryAsync();
    }

    private async Task PersistJobAsync(SyncJob job, CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var transaction = connection.BeginTransaction(IsolationLevel.Serializable);
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = @"
            INSERT OR REPLACE INTO SyncJobs (
                Id, FilePath, RelativePath, Operation, Sha256Hash, FileSize, RetryCount, Priority, Status,
                NextAttemptAt, LastError, CreatedAt, UpdatedAt, Payload)
            VALUES (
                @id, @filePath, @relativePath, @operation, @sha256, @fileSize, @retryCount, @priority, @status,
                @nextAttemptAt, @lastError, @createdAt, @updatedAt, @payload);";
        PopulateCommand(command, job);
        await command.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private async Task EnsureDeduplicationAsync(SyncJob incomingJob, CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);

        if (incomingJob.Operation == SyncOperationType.Delete)
        {
            var existing = await FindLatestPendingJobAsync(connection, incomingJob.FilePath, cancellationToken);
            if (existing is not null && existing.Operation == SyncOperationType.Create)
            {
                await RemoveJobAsync(connection, existing.Id, cancellationToken);
                return;
            }
        }

        if (incomingJob.Operation == SyncOperationType.Create || incomingJob.Operation == SyncOperationType.Update)
        {
            var existing = await FindLatestPendingJobAsync(connection, incomingJob.FilePath, cancellationToken);
            if (existing is not null &&
                (existing.Operation == SyncOperationType.Create || existing.Operation == SyncOperationType.Update) &&
                IsFolderPayload(existing.Payload) == IsFolderPayload(incomingJob.Payload))
            {
                incomingJob.Id = existing.Id;
                incomingJob.Status = existing.Status;
                incomingJob.CreatedAt = existing.CreatedAt;
                incomingJob.UpdatedAt = DateTimeOffset.UtcNow;
                return;
            }
        }
    }

    private async Task<SyncJob?> FindLatestPendingJobAsync(SQLiteConnection connection, string filePath, CancellationToken cancellationToken)
    {
        var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT Id, FilePath, RelativePath, Operation, Sha256Hash, FileSize, RetryCount, Priority, Status, NextAttemptAt, LastError, CreatedAt, UpdatedAt, Payload
            FROM SyncJobs
            WHERE FilePath = @filePath AND Status IN (@pending, @processing)
            ORDER BY CreatedAt DESC
            LIMIT 1;";
        command.Parameters.AddWithValue("@filePath", filePath);
        command.Parameters.AddWithValue("@pending", (int)SyncJobStatus.Pending);
        command.Parameters.AddWithValue("@processing", (int)SyncJobStatus.Processing);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? MapReader(reader) : null;
    }

    private static async Task RemoveJobAsync(SQLiteConnection connection, Guid jobId, CancellationToken cancellationToken)
    {
        var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM SyncJobs WHERE Id = @id;";
        command.Parameters.AddWithValue("@id", jobId.ToString());
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static bool IsFolderPayload(string? payload)
        => !string.IsNullOrWhiteSpace(payload) && payload.Contains("\"folder\":true", StringComparison.OrdinalIgnoreCase);

    private SQLiteConnection CreateConnection()
    {
        return new SQLiteConnection($"Data Source={_databasePath}; Mode=ReadWriteCreate");
    }

    private static void PopulateCommand(SQLiteCommand command, SyncJob job)
    {
        command.Parameters.AddWithValue("@id", job.Id.ToString());
        command.Parameters.AddWithValue("@filePath", job.FilePath);
        command.Parameters.AddWithValue("@relativePath", job.RelativePath);
        command.Parameters.AddWithValue("@operation", (int)job.Operation);
        command.Parameters.AddWithValue("@sha256", (object?)job.Sha256Hash ?? DBNull.Value);
        command.Parameters.AddWithValue("@fileSize", job.FileSize);
        command.Parameters.AddWithValue("@retryCount", job.RetryCount);
        command.Parameters.AddWithValue("@priority", (int)job.Priority);
        command.Parameters.AddWithValue("@status", (int)job.Status);
        command.Parameters.AddWithValue("@nextAttemptAt", (object?)job.NextAttemptAt ?? DBNull.Value);
        command.Parameters.AddWithValue("@lastError", (object?)job.LastError ?? DBNull.Value);
        command.Parameters.AddWithValue("@createdAt", job.CreatedAt);
        command.Parameters.AddWithValue("@updatedAt", job.UpdatedAt);
        command.Parameters.AddWithValue("@payload", (object?)job.Payload ?? DBNull.Value);
    }

    private static async Task UpdateJobAsync(SQLiteConnection connection, SyncJob job, SQLiteTransaction transaction, CancellationToken cancellationToken)
    {
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = @"
            UPDATE SyncJobs
            SET
                Status = @status,
                UpdatedAt = @updatedAt,
                NextAttemptAt = @nextAttemptAt,
                LastError = @lastError,
                RetryCount = @retryCount
            WHERE Id = @id;";
        command.Parameters.AddWithValue("@status", (int)job.Status);
        command.Parameters.AddWithValue("@updatedAt", job.UpdatedAt);
        command.Parameters.AddWithValue("@nextAttemptAt", (object?)job.NextAttemptAt ?? DBNull.Value);
        command.Parameters.AddWithValue("@lastError", (object?)job.LastError ?? DBNull.Value);
        command.Parameters.AddWithValue("@retryCount", job.RetryCount);
        command.Parameters.AddWithValue("@id", job.Id.ToString());
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static SyncJob MapReader(DbDataReader reader)
    {
        return new SyncJob
        {
            Id = Guid.Parse(reader.GetString(0)),
            FilePath = reader.GetString(1),
            RelativePath = reader.GetString(2),
            Operation = (SyncOperationType)reader.GetInt32(3),
            Sha256Hash = reader.IsDBNull(4) ? null : reader.GetString(4),
            FileSize = reader.GetInt64(5),
            RetryCount = reader.GetInt32(6),
            Priority = (SyncPriority)reader.GetInt32(7),
            Status = (SyncJobStatus)reader.GetInt32(8),
            NextAttemptAt = reader.IsDBNull(9) ? null : DateTimeOffset.Parse(reader.GetString(9)),
            LastError = reader.IsDBNull(10) ? null : reader.GetString(10),
            CreatedAt = DateTimeOffset.Parse(reader.GetString(11)),
            UpdatedAt = DateTimeOffset.Parse(reader.GetString(12)),
            Payload = reader.IsDBNull(13) ? null : reader.GetString(13)
        };
    }

    private void PopulateMetadata(SyncJob job)
    {
        if (string.IsNullOrWhiteSpace(job.RelativePath))
        {
            job.RelativePath = Path.GetFileName(job.FilePath);
        }

        if (File.Exists(job.FilePath))
        {
            job.FileSize = new FileInfo(job.FilePath).Length;
            job.Sha256Hash = ComputeSha256(job.FilePath);
            job.Priority = SyncPriority.High;
        }
        else if (Directory.Exists(job.FilePath))
        {
            job.FileSize = 0;
            job.Sha256Hash = null;
            job.Priority = SyncPriority.Normal;
        }
        else
        {
            job.FileSize = 0;
            job.Sha256Hash = null;
        }
    }

    private bool ShouldIgnore(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return true;
        }

        var normalizedPath = path.Replace('\\', '/');
        foreach (var segment in _ignoreList)
        {
            if (normalizedPath.Contains($"/{segment}/", StringComparison.OrdinalIgnoreCase) || normalizedPath.EndsWith($"/{segment}", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        var fileName = Path.GetFileName(path);
        if (fileName.StartsWith("~$", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var extension = Path.GetExtension(path);
        return extension.Equals(".tmp", StringComparison.OrdinalIgnoreCase) || extension.Equals(".temp", StringComparison.OrdinalIgnoreCase) || extension.Equals(".db", StringComparison.OrdinalIgnoreCase) && fileName.Equals("thumbs.db", StringComparison.OrdinalIgnoreCase);
    }

    private static string ComputeSha256(string path)
    {
        using var sha256 = SHA256.Create();
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(sha256.ComputeHash(stream));
    }
}
