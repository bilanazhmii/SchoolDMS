using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

using DocumentSyncClient.Core.Interfaces;
using DocumentSyncClient.Core.Models;
using Microsoft.Extensions.Logging;

namespace DocumentSyncClient.Features.Sync;

/// <summary>
/// Background sync worker that processes queued jobs with retries and uploads
/// local file changes to the SchoolDMS backend.
/// </summary>
public sealed class SyncEngine : ISyncEngine, IAsyncDisposable
{
    private const string DefaultServerUrl = "http://localhost:3000";

    private readonly ISyncQueue _queue;
    private readonly IAppSettingsService _settingsService;
    private readonly IAuthenticationStore _authStore;
    private readonly IAuthenticationService _authService;
    private readonly ILogger<SyncEngine> _logger;
    private readonly CancellationTokenSource _cts = new();
    private Task? _workerTask;
    private Task? _heartbeatTask;
    private int _started;
    private bool _applyingRemoteChanges;
    private DateTimeOffset _remoteEventSuppressUntil;

    public bool IsApplyingRemoteChanges => _applyingRemoteChanges || DateTimeOffset.UtcNow < _remoteEventSuppressUntil;

    /// <summary>
    /// Raised after a job is completed or failed (for live UI indicators).
    /// </summary>
    public event Action<SyncJob, bool>? JobProcessed;

    /// <summary>
    /// Session id returned by the backend heartbeat, used to report jobs.
    /// </summary>
    public string? SessionId { get; private set; }

    /// <summary>
    /// Initializes a new instance of the <see cref="SyncEngine"/> class.
    /// </summary>
    public SyncEngine(
        ISyncQueue queue,
        IAppSettingsService settingsService,
        IAuthenticationStore authStore,
        IAuthenticationService authService,
        ILogger<SyncEngine> logger)
    {
        _queue = queue;
        _settingsService = settingsService;
        _authStore = authStore;
        _authService = authService;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (Interlocked.Exchange(ref _started, 1) == 1) return Task.CompletedTask;
        _workerTask = Task.Run(() => RunLoopAsync(_cts.Token), cancellationToken);
        _heartbeatTask = Task.Run(() => HeartbeatLoopAsync(_cts.Token), cancellationToken);
        return Task.CompletedTask;
    }

    private async Task HeartbeatLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                                await RegisterDeviceAsync(cancellationToken);

            }
            catch (Exception ex)
            {
                _logger.LogDebug("Heartbeat skipped: {Message}", ex.Message);
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    /// <inheritdoc />
    public async Task StopAsync(CancellationToken cancellationToken = default)
    {
        _cts.Cancel();
        var tasks = new[] { _workerTask, _heartbeatTask }.Where(task => task is not null).Cast<Task>().ToArray();
        if (tasks.Length > 0) await Task.WhenAll(tasks).WaitAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task QueueFolderChangeAsync(string path, SyncOperationType operation, string? oldPath = null, CancellationToken cancellationToken = default)
    {
        var settings = await _settingsService.LoadAsync(cancellationToken);
        var relativePath = BuildRelativePath(path, settings);
        if (relativePath is null)
        {
            _logger.LogWarning("Ignoring folder change outside the configured head folder: {Path}", path);
            return;
        }

        var oldRelativePath = oldPath is null ? null : BuildRelativePath(oldPath, settings);
        if (operation is SyncOperationType.Rename or SyncOperationType.Move && oldPath is not null && oldRelativePath is null)
        {
            _logger.LogWarning("Ignoring folder move outside the configured head folder: {Path}", oldPath);
            return;
        }

        var job = new SyncJob
        {
            FilePath = path,
            RelativePath = relativePath,
            Operation = operation,
            Payload = JsonSerializer.Serialize(new { folder = true, oldRelativePath }),
            NextAttemptAt = DateTimeOffset.UtcNow,
        };
        await _queue.EnqueueAsync(job, cancellationToken);
    }

    public async Task QueueFileChangeAsync(string path, SyncOperationType operation, string? payload = null, CancellationToken cancellationToken = default)
    {
        var settings = await _settingsService.LoadAsync(cancellationToken);
        var relativePath = BuildRelativePath(path, settings);
        if (relativePath is null)
        {
            _logger.LogWarning("Ignoring file change outside the configured head folder: {Path}", path);
            return;
        }

        var renamePayload = operation == SyncOperationType.Rename && !string.IsNullOrWhiteSpace(payload)
            ? BuildRelativePath(payload, settings)
            : payload;
        if (operation == SyncOperationType.Rename && !string.IsNullOrWhiteSpace(payload) && renamePayload is null)
        {
            _logger.LogWarning("Ignoring file rename whose old path is outside the configured head folder: {Path}", payload);
            return;
        }

        var job = new SyncJob
        {
            FilePath = path,
            RelativePath = relativePath,
            Operation = operation,
            Payload = renamePayload,
            NextAttemptAt = DateTimeOffset.UtcNow
        };

        await _queue.EnqueueAsync(job, cancellationToken);
    }

    private static string? BuildRelativePath(string filePath, AppSettings settings)
    {
        if (string.IsNullOrWhiteSpace(filePath)) return null;

        var fullFile = NormalizePath(filePath);
        foreach (var root in GetConfiguredRoots(settings))
        {
            var fullRoot = NormalizePath(root);
            if (!IsPathWithinRoot(fullFile, fullRoot, allowRoot: true)) continue;
            var rootName = GetTargetRelativeRoot(settings, fullRoot);
            var inside = Path.GetRelativePath(fullRoot, fullFile).Replace('\\', '/');
            return string.IsNullOrWhiteSpace(rootName) || inside == "." ? rootName : $"{rootName}/{inside}";
        }
        return null;
    }

    private static string NormalizePath(string path) => Path.GetFullPath(path.Trim());

    private static IEnumerable<string> GetConfiguredRoots(AppSettings settings)
        => new[] { settings.SyncFolder }
            .Concat(settings.SyncFolders ?? [])
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct(StringComparer.OrdinalIgnoreCase);

    private static string GetTargetRelativeRoot(AppSettings settings, string normalizedRoot)
    {
        var baseName = Path.GetFileName(normalizedRoot.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
        var sameNamedRoots = GetConfiguredRoots(settings)
            .Select(NormalizePath)
            .Where(root => string.Equals(Path.GetFileName(root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)), baseName, StringComparison.OrdinalIgnoreCase))
            .ToArray();
        if (sameNamedRoots.Length <= 1) return baseName;

        var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalizedRoot))).Substring(0, 8);
        return $"{baseName} ({digest})";
    }

    private static bool IsPathWithinRoot(string path, string root, bool allowRoot)
    {
        if (string.Equals(path, root, StringComparison.OrdinalIgnoreCase)) return allowRoot;
        var rootPrefix = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        return path.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase);
    }

    /// <inheritdoc />
        public async Task SyncFolderAsync(string rootPath, CancellationToken cancellationToken = default)
    {
        var settings = await _settingsService.LoadAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(rootPath) || !Directory.Exists(rootPath))
        {
            return;
        }

                        var requestedRoot = NormalizePath(rootPath);
        var configuredRoot = GetConfiguredRoots(settings)
            .Select(NormalizePath)
            .FirstOrDefault(root => string.Equals(root, requestedRoot, StringComparison.OrdinalIgnoreCase));
        if (configuredRoot is null)
        {
            _logger.LogWarning("Ignoring initial sync request outside configured target folders: {Path}", rootPath);
            return;
        }

        if (string.Equals(Path.GetPathRoot(configuredRoot), configuredRoot, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Ignoring drive-root sync target {Root}; choose a folder below the drive root.", configuredRoot);
            return;
        }

        var files = Directory.EnumerateFiles(requestedRoot, "*", SearchOption.AllDirectories).ToArray();

        var directories = Directory.EnumerateDirectories(requestedRoot, "*", SearchOption.AllDirectories).ToArray();
        var folderPaths = new[] { requestedRoot }.Concat(directories).ToArray();


        var queued = 0;

        // Folder creation is queued as a durable job. A one-shot HTTP call here
        // could be lost during a transient network/API failure, leaving files
        // only partially synchronized.
        foreach (var directory in folderPaths)
        {
            await QueueFolderChangeAsync(directory, SyncOperationType.Create, cancellationToken: cancellationToken);
        }

        foreach (var file in files)
        {
                        var relative = BuildRelativePath(file, settings);
            if (relative is null) continue;
            var job = new SyncJob
            {
                FilePath = file,
                RelativePath = relative,

                Operation = SyncOperationType.Create,
                NextAttemptAt = DateTimeOffset.UtcNow
            };
            await _queue.EnqueueAsync(job, cancellationToken);
            queued++;
        }

        _logger.LogInformation("Initial folder sync queued {Count} files and {FolderCount} folder jobs from {Root}", queued, folderPaths.Length, rootPath);
    }

    /// <summary>
    /// Registers this device with the backend (heartbeat) so the web dashboard
    /// can show the desktop client as online. No-op when not signed in.
    /// </summary>
    private async Task<AuthSession?> GetValidSessionAsync(CancellationToken cancellationToken)
    {
        var session = await _authStore.LoadAsync(cancellationToken);
        if (session is null || string.IsNullOrWhiteSpace(session.AccessToken)) return null;
        if (session.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(2)) return session;

        var refreshed = await _authService.RefreshTokenAsync(session.RefreshToken, cancellationToken);
        if (refreshed is null)
        {
            await _authStore.ClearAsync(cancellationToken);
            return null;
        }
        var updated = new AuthSession
        {
            AccessToken = refreshed.AccessToken,
            RefreshToken = refreshed.RefreshToken,
            Email = refreshed.Email,
            ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(refreshed.ExpiresIn),
        };
        await _authStore.SaveAsync(updated, cancellationToken);
        return updated;
    }

    public async Task RegisterDeviceAsync(CancellationToken cancellationToken = default)
    {
        var session = await GetValidSessionAsync(cancellationToken);
        if (session is null) return;

                var settings = await _settingsService.LoadAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(settings.DeviceId))
        {
            settings.DeviceId = Guid.NewGuid().ToString("N");
            await _settingsService.SaveAsync(settings, cancellationToken);
        }

        var targets = GetConfiguredRoots(settings)
            .Select(root => new
            {
                relativeRoot = GetTargetRelativeRoot(settings, NormalizePath(root)),
                localPath = NormalizePath(root),
                active = true,
            })
            .Where(target => !string.IsNullOrWhiteSpace(target.relativeRoot) &&
                            !string.Equals(Path.GetPathRoot(target.localPath), target.localPath, StringComparison.OrdinalIgnoreCase))
            .ToArray();

        var targetSignature = string.Join("|", targets.Select(target => $"{target.relativeRoot}={target.localPath}"));
        if (!string.Equals(settings.SyncTargetSignature, targetSignature, StringComparison.Ordinal))
        {
            settings.SyncTargetSignature = targetSignature;
            settings.RemoteSyncCursor = string.Empty;
            await _settingsService.SaveAsync(settings, cancellationToken);
        }

        var baseUrl = (string.IsNullOrWhiteSpace(settings.ServerUrl)

            ? "http://localhost:3000"
            : settings.ServerUrl).TrimEnd('/');

        try
        {
            using var client = CreateHttpClient(baseUrl, session.AccessToken);
            var response = await client.PostAsJsonAsync(
                "/sync/heartbeat",
                new
                {
                    deviceIdentifier = settings.DeviceId,
                    hostname = Environment.MachineName,
                    machineName = Environment.MachineName,
                                        clientVersion = typeof(SyncEngine).Assembly.GetName().Version?.ToString() ?? "1.0.0",
                    targets,
                },

                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var detail = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Device heartbeat rejected by backend ({StatusCode}): {Detail}", response.StatusCode, detail);
                return;
            }

            var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
            if (body.TryGetProperty("data", out var data) &&
                data.TryGetProperty("sessionId", out var sessionId) &&
                sessionId.ValueKind == JsonValueKind.String)
            {
                SessionId = sessionId.GetString();
                _logger.LogInformation("Device registered with backend (session {SessionId})", SessionId);
            }
            else
            {
                _logger.LogWarning("Device heartbeat succeeded but backend returned no session ID.");
            }
        }
                catch (Exception ex)
        {
            _logger.LogWarning("Device registration failed: {Message}", ex.Message);
        }

        if (!string.IsNullOrWhiteSpace(SessionId))
        {
            await PullRemoteChangesAsync(cancellationToken);
        }
    }

    private async Task ReportJobAsync(SyncJob job, bool success, string? error, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(SessionId))
        {
            return;
        }

        var session = await _authStore.LoadAsync(cancellationToken);
        if (session is null || string.IsNullOrWhiteSpace(session.AccessToken))
        {
            return;
        }

        var settings = await _settingsService.LoadAsync(cancellationToken);
        var baseUrl = (string.IsNullOrWhiteSpace(settings.ServerUrl)
            ? "http://localhost:3000"
            : settings.ServerUrl).TrimEnd('/');

        try
        {
            using var client = CreateHttpClient(baseUrl, session.AccessToken);
            await client.PostAsJsonAsync(
                "/sync/jobs",
                new
                {
                    sessionId = SessionId,
                    operation = MapOperation(job.Operation),
                    status = success ? "SYNCED" : "FAILED",
                    filePath = job.FilePath,
                    relativePath = job.RelativePath,
                    message = error,
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogDebug("Job report failed (non-critical): {Message}", ex.Message);
        }
    }

    private static string MapOperation(SyncOperationType operation) => operation switch
    {
        SyncOperationType.Create => "UPLOAD",
        SyncOperationType.Update => "UPLOAD",
        SyncOperationType.Delete => "DELETE",
        SyncOperationType.Rename => "RENAME",
        SyncOperationType.Move => "MOVE",
        _ => "UPLOAD"
    };

    private async Task RunLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var settings = await _settingsService.LoadAsync(cancellationToken);
                if (!settings.AutoSync)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
                    continue;
                }

                var job = await _queue.DequeueNextAsync(cancellationToken);
                if (job is null)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
                    continue;
                }

                try
                {
                    await ProcessJobAsync(job, cancellationToken);
                    await _queue.CompleteAsync(job.Id, cancellationToken);
                    _logger.LogInformation("Sync job {JobId} completed ({Operation} {Path})", job.Id, job.Operation, job.RelativePath);
                    JobProcessed?.Invoke(job, true);
                    _ = ReportJobAsync(job, true, null);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Sync job {JobId} failed: {Message}", job.Id, ex.Message);
                    await _queue.FailAsync(job.Id, ex.Message, cancellationToken);
                    JobProcessed?.Invoke(job, false);
                    _ = ReportJobAsync(job, false, ex.Message);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Sync loop error: {Message}", ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            }
        }
    }

    private async Task ProcessJobAsync(SyncJob job, CancellationToken cancellationToken)
    {
                var settings = await _settingsService.LoadAsync(cancellationToken);
        if (!IsJobInsideConfiguredRoot(job, settings))
        {
            _logger.LogWarning("Discarding stale sync job outside the configured head folder: {Path}", job.FilePath);
            return;
        }

        var baseUrl = string.IsNullOrWhiteSpace(settings.ServerUrl)

            ? DefaultServerUrl
            : settings.ServerUrl.TrimEnd('/');

        var session = await GetValidSessionAsync(cancellationToken);
        if (session is null) throw new InvalidOperationException("Not authenticated. Sign in to synchronize files.");

        using var client = CreateHttpClient(baseUrl, session.AccessToken);

        if (IsFolderPayload(job.Payload))
        {
            await ProcessFolderJobAsync(client, job, cancellationToken);
            return;
        }

        switch (job.Operation)
        {
            case SyncOperationType.Create:
            case SyncOperationType.Update:
                await UploadFileAsync(client, job, cancellationToken);
                break;

            case SyncOperationType.Delete:
                await DeleteFileAsync(client, job, cancellationToken);
                break;

            case SyncOperationType.Rename:
            case SyncOperationType.Move:
                await MoveFileAsync(client, job, cancellationToken);
                break;

            default:
                throw new InvalidOperationException($"Unsupported sync operation: {job.Operation}");
        }
    }

    private static HttpClient CreateHttpClient(string baseUrl, string accessToken)
    {
        var client = new HttpClient { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromSeconds(120) };
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }

    private static bool IsFolderPayload(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return false;
        try { using var doc = JsonDocument.Parse(payload); return doc.RootElement.TryGetProperty("folder", out var folder) && folder.GetBoolean(); }
        catch (JsonException) { return false; }
    }

    private static string? ExtractOldRelativePath(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return null;
        try { using var doc = JsonDocument.Parse(payload); return doc.RootElement.TryGetProperty("oldRelativePath", out var oldPath) ? oldPath.GetString() : null; }
        catch (JsonException) { return null; }
    }

    private async Task ProcessFolderJobAsync(HttpClient client, SyncJob job, CancellationToken cancellationToken)
    {
        if (job.Operation is SyncOperationType.Create or SyncOperationType.Update)
        {
            using var response = await client.PostAsJsonAsync("/folders/by-path", new { relativePath = job.RelativePath }, cancellationToken);
            response.EnsureSuccessStatusCode();
            return;
        }
        if (job.Operation == SyncOperationType.Delete)
        {
            var path = Uri.EscapeDataString(job.RelativePath.Replace('\\', '/'));
            using var response = await client.DeleteAsync($"/folders/by-path?relativePath={path}", cancellationToken);
            response.EnsureSuccessStatusCode();
            return;
        }
        var oldPath = ExtractOldRelativePath(job.Payload);
        if (string.IsNullOrWhiteSpace(oldPath)) throw new InvalidOperationException("Folder rename/move is missing its old path.");
        using var moveResponse = await client.PostAsJsonAsync("/folders/by-path/move", new { oldRelativePath = oldPath, newRelativePath = job.RelativePath }, cancellationToken);
        moveResponse.EnsureSuccessStatusCode();
    }

    private async Task UploadFileAsync(HttpClient client, SyncJob job, CancellationToken cancellationToken)
    {
        if (!File.Exists(job.FilePath))
        {
            throw new FileNotFoundException($"File no longer exists: {job.FilePath}");
        }

        await using var stream = File.OpenRead(job.FilePath);
        var hash = await ComputeSha256Async(job.FilePath, cancellationToken);
        if (!string.IsNullOrWhiteSpace(job.Sha256Hash) &&
            string.Equals(job.Sha256Hash, hash, StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(ExtractFileId(job.Payload)))
        {
            _logger.LogInformation("File {Path} is unchanged, skipping upload.", job.FilePath);
            return;
        }

        using var content = new MultipartFormDataContent();
        var fileContent = new StreamContent(stream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(DetectMimeType(job.FilePath));
        var relative = string.IsNullOrWhiteSpace(job.RelativePath)
            ? Path.GetFileName(job.FilePath)
            : job.RelativePath.Replace('\\', '/');
        content.Add(fileContent, "files", Path.GetFileName(job.FilePath));
        content.Add(new StringContent(relative), "relativePath");

        using var response = await client.PostAsync("/files/upload", content, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Upload failed ({response.StatusCode}): {await response.Content.ReadAsStringAsync(cancellationToken)}");
        }

        var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
        if (body.TryGetProperty("success", out var success) && !success.GetBoolean())
        {
            throw new HttpRequestException("Backend reported an upload failure.");
        }

        if (body.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array && data.GetArrayLength() > 0)
        {
            var first = data[0];
            if (first.TryGetProperty("id", out var idProp))
            {
                job.Payload = JsonSerializer.Serialize(new { fileId = idProp.GetString() });
            }
        }

        _logger.LogInformation("Uploaded {Path} ({Bytes} bytes)", job.FilePath, job.FileSize);
    }

    private async Task DeleteFileAsync(HttpClient client, SyncJob job, CancellationToken cancellationToken)
    {
        var fileId = ExtractFileId(job.Payload);
        HttpResponseMessage response;
        if (string.IsNullOrWhiteSpace(fileId))
        {
            var relative = Uri.EscapeDataString(job.RelativePath.Replace('\\', '/'));
            response = await client.DeleteAsync($"/files/by-path?relativePath={relative}", cancellationToken);
        }
        else
        {
            response = await client.DeleteAsync($"/files/{fileId}", cancellationToken);
        }
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Delete failed ({response.StatusCode}): {await response.Content.ReadAsStringAsync(cancellationToken)}");
        }
    }

    private async Task MoveFileAsync(HttpClient client, SyncJob job, CancellationToken cancellationToken)
    {
        var fileId = ExtractFileId(job.Payload);
        HttpResponseMessage response;
        if (string.IsNullOrWhiteSpace(fileId) && job.Operation == SyncOperationType.Rename && !string.IsNullOrWhiteSpace(job.Payload))
        {
            response = await client.PostAsJsonAsync(
                "/files/by-path/move",
                new { oldRelativePath = job.Payload, newRelativePath = job.RelativePath },
                cancellationToken);
        }
        else if (string.IsNullOrWhiteSpace(fileId))
        {
            await UploadFileAsync(client, job, cancellationToken);
            return;
        }
        else
        {
            response = await client.PostAsJsonAsync(
                $"/files/{fileId}/move",
                new { toFolderId = (string?)null },
                cancellationToken);
        }
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Move failed ({response.StatusCode}): {await response.Content.ReadAsStringAsync(cancellationToken)}");
        }
    }

    private static string? ExtractFileId(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return null;
        try
        {
            using var doc = JsonDocument.Parse(payload);
            return doc.RootElement.TryGetProperty("fileId", out var id) ? id.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static async Task<string> ComputeSha256Async(string path, CancellationToken cancellationToken)
    {
        using var sha256 = SHA256.Create();
        await using var stream = File.OpenRead(path);
        var hash = await sha256.ComputeHashAsync(stream, cancellationToken);
        return Convert.ToHexString(hash);
    }

        private async Task PullRemoteChangesAsync(CancellationToken cancellationToken)
    {
        var session = await GetValidSessionAsync(cancellationToken);
        if (session is null) return;
        var settings = await _settingsService.LoadAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(settings.DeviceId))
        {
            settings.DeviceId = Guid.NewGuid().ToString("N");
            await _settingsService.SaveAsync(settings, cancellationToken);
        }
        var baseUrl = (string.IsNullOrWhiteSpace(settings.ServerUrl) ? DefaultServerUrl : settings.ServerUrl).TrimEnd('/');
        var deviceQuery = $"&deviceIdentifier={Uri.EscapeDataString(settings.DeviceId)}";
        var query = string.IsNullOrWhiteSpace(settings.RemoteSyncCursor)
            ? $"/sync/changes?limit=200{deviceQuery}"
            : $"/sync/changes?limit=200&since={Uri.EscapeDataString(settings.RemoteSyncCursor)}{deviceQuery}";

        try
        {
            using var client = CreateHttpClient(baseUrl, session.AccessToken);
            using var response = await client.GetAsync(query, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Remote change pull failed ({StatusCode})", response.StatusCode);
                return;
            }

            using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
            var root = document.RootElement;
            var data = root.TryGetProperty("data", out var wrapped) ? wrapped : root;
            if (!data.TryGetProperty("cursor", out var cursorProperty)) return;
            var cursor = cursorProperty.GetString();
            if (string.IsNullOrWhiteSpace(cursor)) return;

                        _applyingRemoteChanges = true;
            var applied = true;

                        if (data.TryGetProperty("changes", out var changes) && changes.ValueKind == JsonValueKind.Array)
            {
                foreach (var change in changes.EnumerateArray())
                {
                    if (!IsChangeForConfiguredTargets(settings, change)) continue;
                    try
                    {
                        await ApplyRemoteChangeAsync(client, settings, change, cancellationToken);

                    }
                    catch (Exception ex)
                    {
                        applied = false;
                        _logger.LogWarning(ex, "Remote change apply failed for {Path}", GetString(change, "relativePath"));
                    }
                }
            }
            await Task.Delay(TimeSpan.FromMilliseconds(750), cancellationToken);
            _applyingRemoteChanges = false;
            _remoteEventSuppressUntil = DateTimeOffset.UtcNow.AddSeconds(2);

            if (applied)
            {
                settings.RemoteSyncCursor = cursor;
                await _settingsService.SaveAsync(settings, cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
                        _applyingRemoteChanges = false;
            _remoteEventSuppressUntil = DateTimeOffset.UtcNow.AddSeconds(2);
            throw;

        }
        catch (Exception ex)
        {
                        _applyingRemoteChanges = false;
            _remoteEventSuppressUntil = DateTimeOffset.UtcNow.AddSeconds(2);
            _logger.LogWarning("Remote change pull failed: {Message}", ex.Message);

        }
    }

        private static bool IsChangeForConfiguredTargets(AppSettings settings, JsonElement change)
    {
        var paths = new[] { GetString(change, "relativePath"), GetString(change, "oldRelativePath") }
            .Where(path => !string.IsNullOrWhiteSpace(path));
        var roots = GetConfiguredRoots(settings)
            .Select(root => GetTargetRelativeRoot(settings, NormalizePath(root)))
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        return paths.Any(path =>
        {
            var parts = path!.Replace('\\', '/').Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries).ToList();
            if (parts.Count > 0 && string.Equals(parts[0], "My Files", StringComparison.OrdinalIgnoreCase)) parts.RemoveAt(0);
            return parts.Count > 0 && roots.Contains(parts[0]);
        });
    }

    private async Task ApplyRemoteChangeAsync(HttpClient client, AppSettings settings, JsonElement change, CancellationToken cancellationToken)

    {
                var operation = GetString(change, "operation")?.ToUpperInvariant();
        var relativePath = GetString(change, "relativePath");
        var oldRelativePath = GetString(change, "oldRelativePath");
        var fileId = GetString(change, "fileId");
        var folderId = GetString(change, "folderId");
        var remoteSha256 = GetString(change, "sha256");

        var localPath = ResolveLocalPath(settings, relativePath);
        var oldLocalPath = ResolveLocalPath(settings, oldRelativePath);

                var localRoots = GetConfiguredRoots(settings).Select(NormalizePath).ToArray();
        if (operation == "DELETE")
        {
            if (localPath is not null && localRoots.Any(root => string.Equals(localPath, root, StringComparison.OrdinalIgnoreCase)))
            {
                _logger.LogWarning("Ignoring remote delete of a configured local target root {Root}.", localPath);
                return;
            }
            if (localPath is not null && File.Exists(localPath))
            {
                if (!string.IsNullOrWhiteSpace(remoteSha256))
                {
                    var localSha256 = await ComputeSha256Async(localPath, cancellationToken);
                    if (!string.Equals(localSha256, remoteSha256, StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogWarning("Preserving local edit instead of applying remote delete for {Path}.", localPath);
                        await QueueFileChangeAsync(localPath, SyncOperationType.Update, cancellationToken: cancellationToken);
                        return;
                    }
                }
            }
            if (localPath is not null && Directory.Exists(localPath))
            {
                _logger.LogWarning("Preserving local folder instead of applying remote delete for {Path}.", localPath);
                return;
            }
            DeleteLocalPath(localPath);
            return;
        }

        if (operation is "MOVE" or "RENAME")
        {
            if (oldLocalPath is not null && localPath is not null &&
                (localRoots.Any(root => string.Equals(oldLocalPath, root, StringComparison.OrdinalIgnoreCase)) || localRoots.Any(root => string.Equals(localPath, root, StringComparison.OrdinalIgnoreCase))))
            {
                _logger.LogWarning("Ignoring remote move/rename of a configured local target root.");
                return;
            }

                        if (oldLocalPath is not null && localPath is not null && !string.Equals(oldLocalPath, localPath, StringComparison.OrdinalIgnoreCase))
            {
                if (File.Exists(localPath) || Directory.Exists(localPath))
                {
                    _logger.LogWarning("Preserving local destination instead of overwriting it during remote move {Path}.", localPath);
                    return;
                }
                Directory.CreateDirectory(Path.GetDirectoryName(localPath)!);
                if (Directory.Exists(oldLocalPath))
                {
                    Directory.Move(oldLocalPath, localPath);
                }
                else if (File.Exists(oldLocalPath))
                {
                    File.Move(oldLocalPath, localPath);
                }
            }

            else if (fileId is not null && localPath is not null)
            {
                await DownloadRemoteFileAsync(client, fileId, localPath, cancellationToken);
            }
            return;
        }

        if (operation == "UPLOAD" && fileId is null)
        {
            if (localPath is not null) Directory.CreateDirectory(localPath);
            return;
        }

                if (operation == "UPLOAD" && fileId is not null && localPath is not null)
        {
            if (File.Exists(localPath))
            {
                if (!string.IsNullOrWhiteSpace(remoteSha256))
                {
                    var localSha256 = await ComputeSha256Async(localPath, cancellationToken);
                    if (string.Equals(localSha256, remoteSha256, StringComparison.OrdinalIgnoreCase)) return;
                }
                _logger.LogWarning("Preserving local edit instead of overwriting {Path} with a remote version.", localPath);
                await QueueFileChangeAsync(localPath, SyncOperationType.Update, cancellationToken: cancellationToken);
                return;
            }
            await DownloadRemoteFileAsync(client, fileId, localPath, cancellationToken);
        }

    }

    private static async Task DownloadRemoteFileAsync(HttpClient client, string fileId, string localPath, CancellationToken cancellationToken)
    {
        using var response = await client.GetAsync($"/files/{Uri.EscapeDataString(fileId)}/download", cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            DeleteLocalPath(localPath);
            return;
        }
        response.EnsureSuccessStatusCode();
        Directory.CreateDirectory(Path.GetDirectoryName(localPath)!);
        var tempPath = localPath + ".schooldms.tmp";
        await using (var source = await response.Content.ReadAsStreamAsync(cancellationToken))
        await using (var target = File.Create(tempPath))
        {
            await source.CopyToAsync(target, cancellationToken);
        }
        File.Move(tempPath, localPath, true);
    }

    private static string? ResolveLocalPath(AppSettings settings, string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return null;
        var normalized = relativePath.Replace('\\', '/').Trim('/');
        var parts = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries).ToList();
        if (parts.Count > 0 && string.Equals(parts[0], "My Files", StringComparison.OrdinalIgnoreCase))
            parts.RemoveAt(0);

        foreach (var root in GetConfiguredRoots(settings))
        {
            var rootFull = NormalizePath(root);
            var rootName = GetTargetRelativeRoot(settings, rootFull);
            var start = parts.Count > 0 && string.Equals(parts[0], rootName, StringComparison.OrdinalIgnoreCase) ? 1 : 0;
            var candidate = NormalizePath(Path.Combine(new[] { rootFull }.Concat(parts.Skip(start)).ToArray()));
            if (IsPathWithinRoot(candidate, rootFull, allowRoot: true)) return candidate;
        }
        return null;
    }

    private static bool IsJobInsideConfiguredRoot(SyncJob job, AppSettings settings)
    {
        if (string.IsNullOrWhiteSpace(job.FilePath)) return false;
        var path = NormalizePath(job.FilePath);
        if (!GetConfiguredRoots(settings).Select(NormalizePath).Any(root => IsPathWithinRoot(path, root, allowRoot: true))) return false;
        var expectedRelative = BuildRelativePath(job.FilePath, settings);
        return expectedRelative is not null && string.Equals(expectedRelative, job.RelativePath.Replace('\\', '/'), StringComparison.OrdinalIgnoreCase);
    }

    private static void DeleteLocalPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return;
        if (File.Exists(path)) File.Delete(path);
        else if (Directory.Exists(path)) Directory.Delete(path, true);
    }

    private static string? GetString(JsonElement element, string property)
        => element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static string DetectMimeType(string path)

    {
        var extension = Path.GetExtension(path).ToLowerInvariant();
        return extension switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".svg" => "image/svg+xml",
            ".txt" or ".md" => "text/plain",
            ".html" or ".htm" => "text/html",
            ".json" => "application/json",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".zip" => "application/zip",
            _ => "application/octet-stream"
        };
    }

    /// <inheritdoc />
    public async ValueTask DisposeAsync()
    {
        _cts.Cancel();
        if (_workerTask is not null)
        {
            await _workerTask;
        }

        _cts.Dispose();
    }
}
