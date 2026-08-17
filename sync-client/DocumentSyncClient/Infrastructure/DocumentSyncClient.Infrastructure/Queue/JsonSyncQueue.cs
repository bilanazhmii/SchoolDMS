using System.Text.Json;
using DocumentSyncClient.Core.Interfaces;
using DocumentSyncClient.Core.Models;

namespace DocumentSyncClient.Infrastructure.Queue;

/// <summary>
/// Persists sync jobs to disk in JSON form so they survive app restarts.
/// </summary>
public sealed class JsonSyncQueue : ISyncQueue
{
    private readonly string _filePath;
    private readonly object _syncRoot = new();

    /// <summary>
    /// Initializes a new instance of the <see cref="JsonSyncQueue"/> class.
    /// </summary>
    public JsonSyncQueue()
    {
        var appDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DocumentSyncClient");
        Directory.CreateDirectory(appDataFolder);
        _filePath = Path.Combine(appDataFolder, "sync-queue.json");
    }

    /// <inheritdoc />
    public async Task EnqueueAsync(SyncJob job, CancellationToken cancellationToken = default)
    {
        List<SyncJob> jobs;
        if (File.Exists(_filePath))
        {
            var content = await File.ReadAllTextAsync(_filePath, cancellationToken);
            jobs = JsonSerializer.Deserialize<List<SyncJob>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        else
        {
            jobs = [];
        }

        jobs.Add(job);
        await SaveAsync(jobs, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<SyncJob?> DequeueNextAsync(CancellationToken cancellationToken = default)
    {
        var jobs = await LoadAsync(cancellationToken);
        var next = jobs
            .Where(job => job.Status != SyncJobStatus.Completed && (job.NextAttemptAt is null || job.NextAttemptAt <= DateTimeOffset.UtcNow))
            .OrderBy(job => job.CreatedAt)
            .FirstOrDefault();

        if (next is null)
        {
            return null;
        }

        jobs.Remove(next);
        await SaveAsync(jobs, cancellationToken);
        return next;
    }

    /// <inheritdoc />
    public async Task CompleteAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        var jobs = await LoadAsync(cancellationToken);
        var job = jobs.FirstOrDefault(item => item.Id == jobId);
        if (job is not null)
        {
            job.Status = SyncJobStatus.Completed;
            job.UpdatedAt = DateTimeOffset.UtcNow;
            await SaveAsync(jobs, cancellationToken);
        }
    }

    /// <inheritdoc />
    public async Task FailAsync(Guid jobId, string error, CancellationToken cancellationToken = default)
    {
        var jobs = await LoadAsync(cancellationToken);
        var job = jobs.FirstOrDefault(item => item.Id == jobId);
        if (job is not null)
        {
            job.RetryCount += 1;
            job.LastError = error;
            job.NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(Math.Min(30, Math.Pow(2, job.RetryCount)));
            job.UpdatedAt = DateTimeOffset.UtcNow;
            jobs.Add(job);
            await SaveAsync(jobs, cancellationToken);
        }
    }

    private async Task<List<SyncJob>> LoadAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_filePath))
        {
            return [];
        }

        var content = await File.ReadAllTextAsync(_filePath, cancellationToken);
        return JsonSerializer.Deserialize<List<SyncJob>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
    }

    private async Task SaveAsync(List<SyncJob> jobs, CancellationToken cancellationToken)
    {
        lock (_syncRoot)
        {
            var json = JsonSerializer.Serialize(jobs, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_filePath, json);
        }

        await Task.CompletedTask;
    }
}
