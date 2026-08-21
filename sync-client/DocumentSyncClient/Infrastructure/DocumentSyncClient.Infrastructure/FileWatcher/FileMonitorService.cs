using System.Collections.Concurrent;
using System.IO;
using DocumentSyncClient.Core.Interfaces;
using DocumentSyncClient.Core.Models;
using Microsoft.Extensions.Logging;

namespace DocumentSyncClient.Infrastructure.FileWatcher;

/// <summary>
/// Watches a local folder for filesystem changes and turns them into sync jobs.
/// </summary>
public sealed class FileMonitorService : IFileMonitorService
{
    private readonly ISyncEngine _syncEngine;
    private readonly ILogger<FileMonitorService> _logger;
    private readonly ConcurrentDictionary<string, DateTimeOffset> _debounceTimes = new(StringComparer.OrdinalIgnoreCase);
    private readonly TimeSpan _debounceWindow = TimeSpan.FromMilliseconds(500);
    private static readonly TimeSpan DeleteConfirmationDelay = TimeSpan.FromMilliseconds(750);

    private readonly HashSet<string> _temporaryFileExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".tmp",
        ".temp",
        ".swp",
        ".swo",
        ".~",
        ".bak"
    };

    private readonly List<FileSystemWatcher> _watchers = [];
    private readonly ConcurrentDictionary<string, byte> _knownDirectories = new(StringComparer.OrdinalIgnoreCase);

    private CancellationTokenSource? _cts;
    private Task? _processingTask;

    /// <summary>
    /// Initializes a new instance of the <see cref="FileMonitorService"/> class.
    /// </summary>
    public FileMonitorService(ISyncEngine syncEngine, ILogger<FileMonitorService> logger)
    {
        _syncEngine = syncEngine;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(string? rootPath = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(rootPath))
        {
            throw new ArgumentException("A root path is required for file monitoring.", nameof(rootPath));
        }

        if (!Directory.Exists(rootPath))
        {
            throw new DirectoryNotFoundException($"The monitoring root '{rootPath}' was not found.");
        }

        _cts ??= CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        if (_watchers.Any(w => string.Equals(w.Path, rootPath, StringComparison.OrdinalIgnoreCase)))
        {
            return Task.CompletedTask;
        }

        RememberDirectories(rootPath);

        var watcher = new FileSystemWatcher(rootPath)

        {
            IncludeSubdirectories = true,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size | NotifyFilters.CreationTime
        };

        watcher.Created += OnChanged;
        watcher.Deleted += OnChanged;
        watcher.Changed += OnChanged;
        watcher.Renamed += OnRenamed;
        watcher.Error += OnError;
        watcher.EnableRaisingEvents = true;
        _watchers.Add(watcher);

        _processingTask ??= Task.Run(() => DrainDebouncedEventsAsync(_cts.Token), CancellationToken.None);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken = default)
    {
        foreach (var watcher in _watchers)
        {
            watcher.EnableRaisingEvents = false;
            watcher.Dispose();
        }
        _watchers.Clear();
        _cts?.Cancel();
        return Task.CompletedTask;
    }

    private void OnChanged(object sender, FileSystemEventArgs e)
    {
        var watchedRoot = (sender as FileSystemWatcher)?.Path;
        var isKnownDirectory = _knownDirectories.ContainsKey(e.FullPath);
        if (e.ChangeType != WatcherChangeTypes.Deleted && Directory.Exists(e.FullPath))
        {
            _knownDirectories.TryAdd(e.FullPath, 0);
            isKnownDirectory = true;
        }

        _ = Task.Run(() => HandleEventAsync(e.FullPath, ResolveOperation(e.ChangeType), watchedRoot: watchedRoot, isDirectoryHint: isKnownDirectory), CancellationToken.None);
    }

    private void OnRenamed(object sender, RenamedEventArgs e)
    {
        var watchedRoot = (sender as FileSystemWatcher)?.Path;
        var wasKnownDirectory = _knownDirectories.TryRemove(e.OldFullPath, out _);
        if (Directory.Exists(e.FullPath))
        {
            _knownDirectories.TryAdd(e.FullPath, 0);
            wasKnownDirectory = true;
        }

        _ = Task.Run(() => HandleEventAsync(e.FullPath, SyncOperationType.Rename, e.OldFullPath, watchedRoot, wasKnownDirectory), CancellationToken.None);
    }

    private void OnError(object sender, ErrorEventArgs e)
    {
        _logger.LogError(e.GetException(), "File watcher reported an error.");
    }

    private async Task HandleEventAsync(string path, SyncOperationType operation, string? payload = null, string? watchedRoot = null, bool isDirectoryHint = false)
    {
        if (string.IsNullOrWhiteSpace(path) || IsIgnored(path) || _syncEngine.IsApplyingRemoteChanges)
        {
            return;
        }

        // A shutdown, disconnected volume, or temporarily unavailable sync root can
        // produce delete-like watcher events. Never turn those into destructive web
        // operations. A delete is propagated only when the watched root and the
        // deleted item's parent remain healthy after a short confirmation window.
        if (operation == SyncOperationType.Delete && !await IsConfirmedLocalDeleteAsync(path, watchedRoot))
        {
            _logger.LogWarning("Ignoring unconfirmed local delete event for {Path}; the sync root may be unavailable.", path);
            return;
        }

        if (isDirectoryHint || Directory.Exists(path))
        {
            if (operation == SyncOperationType.Rename && payload is not null)
                await _syncEngine.QueueFolderChangeAsync(path, operation, payload);
            else if (operation == SyncOperationType.Delete)
            {
                _knownDirectories.TryRemove(path, out _);
                await _syncEngine.QueueFolderChangeAsync(path, operation);
            }
            else
                await _syncEngine.SyncFolderAsync(path);
            return;
        }


        if (operation != SyncOperationType.Delete && !await IsAccessibleAsync(path))
        {
            _logger.LogInformation("Skipping pending file event for inaccessible path {Path}", path);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        _debounceTimes[path] = now;
        await Task.Delay(_debounceWindow);

        if (!_debounceTimes.TryGetValue(path, out var lastTime) || lastTime != now)
        {
            return;
        }

        if (operation == SyncOperationType.Rename && payload is not null)
        {
            await _syncEngine.QueueFileChangeAsync(path, operation, payload);
            return;
        }

        await _syncEngine.QueueFileChangeAsync(path, operation);
    }

    private void RememberDirectories(string rootPath)
    {
        _knownDirectories.TryAdd(rootPath, 0);
        try
        {
            foreach (var directory in Directory.EnumerateDirectories(rootPath, "*", SearchOption.AllDirectories))
            {
                _knownDirectories.TryAdd(directory, 0);
            }
        }
        catch (IOException ex)
        {
            _logger.LogWarning(ex, "Could not fully index sync directories under {Root}.", rootPath);
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Could not access all sync directories under {Root}.", rootPath);
        }
    }

    private async Task<bool> IsConfirmedLocalDeleteAsync(string path, string? watchedRoot)
    {
        if (string.IsNullOrWhiteSpace(watchedRoot)) return false;

        try
        {
            var root = Path.GetFullPath(watchedRoot);
            var deletedPath = Path.GetFullPath(path);
            var rootPrefix = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;

            // The sync root itself is never a deletable item. Keeping web data is
            // safer than interpreting a missing/unmounted root as a full delete.
            if (string.Equals(root, deletedPath, StringComparison.OrdinalIgnoreCase) ||
                !deletedPath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            await Task.Delay(DeleteConfirmationDelay);

            if (!Directory.Exists(root)) return false;
            if (File.Exists(deletedPath) || Directory.Exists(deletedPath)) return false;

            var parent = Directory.GetParent(deletedPath);
            if (parent is null || !Directory.Exists(parent.FullName)) return false;

            // Force one directory read so disconnected/network-backed roots fail
            // here instead of being treated as a valid local deletion.
            _ = Directory.EnumerateFileSystemEntries(root).Take(1).ToArray();
            return true;
        }
        catch (IOException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private async Task DrainDebouncedEventsAsync(CancellationToken cancellationToken)
    {
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Expected during tray Exit or application shutdown.
        }
    }

    private static SyncOperationType ResolveOperation(WatcherChangeTypes changeType) => changeType switch
    {
        WatcherChangeTypes.Created => SyncOperationType.Create,
        WatcherChangeTypes.Deleted => SyncOperationType.Delete,
        WatcherChangeTypes.Changed => SyncOperationType.Update,
        _ => SyncOperationType.Update
    };

    private static bool IsIgnored(string path)
    {
        var fileName = Path.GetFileName(path);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return false;
        }

        var ignoredPrefixes = new[] { "~$", ".tmp", ".temp", ".swp", ".swo" };
        if (ignoredPrefixes.Any(prefix => fileName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
        {
            return true;
        }

        var extension = Path.GetExtension(path);
        return extension.Equals(".tmp", StringComparison.OrdinalIgnoreCase) || extension.Equals(".temp", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<bool> IsAccessibleAsync(string path)
    {
        if (Directory.Exists(path)) return true;
        if (!File.Exists(path)) return false;

        for (var attempt = 0; attempt < 20; attempt++)
        {
            try
            {
                long firstLength;
                long secondLength;
                await using (var first = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                {
                    firstLength = first.Length;
                }
                await Task.Delay(150);
                if (!File.Exists(path)) return false;
                await using (var second = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                {
                    secondLength = second.Length;
                }
                if (firstLength == secondLength) return true;
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            await Task.Delay(250);
        }
        return File.Exists(path);
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        foreach (var watcher in _watchers)
        {
            watcher.EnableRaisingEvents = false;
            watcher.Dispose();
        }
        _watchers.Clear();

        _cts?.Cancel();
        if (_processingTask is not null)
        {
            await _processingTask;
        }

        _cts?.Dispose();
    }
}
