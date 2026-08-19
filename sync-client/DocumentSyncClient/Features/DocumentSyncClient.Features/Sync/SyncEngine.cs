using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
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
        _workerTask = Task.Run(() => RunLoopAsync(_cts.Token), cancellationToken);
        _ = Task.Run(() => HeartbeatLoopAsync(_cts.Token), cancellationToken);
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
                await Task.Delay(TimeSpan.FromSeconds(60), cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken = default)
    {
        _cts.Cancel();
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public async Task QueueFileChangeAsync(string path, SyncOperationType operation, string? payload = null, CancellationToken cancellationToken = default)
    {
        var job = new SyncJob
        {
            FilePath = path,
            Operation = operation,
            Payload = payload,
            NextAttemptAt = DateTimeOffset.UtcNow
        };

        await _queue.EnqueueAsync(job, cancellationToken);
    }

    /// <inheritdoc />
    public async Task SyncFolderAsync(string rootPath, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(rootPath) || !Directory.Exists(rootPath))
        {
            return;
        }

        var files = Directory.EnumerateFiles(rootPath, "*", SearchOption.AllDirectories);
        var queued = 0;
        foreach (var file in files)
        {
            var relative = Path.GetRelativePath(rootPath, file).Replace('\\', '/');
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

        _logger.LogInformation("Initial folder sync queued {Count} files from {Root}", queued, rootPath);
    }

    /// <summary>
    /// Registers this device with the backend (heartbeat) so the web dashboard
    /// can show the desktop client as online. No-op when not signed in.
    /// </summary>
    public async Task RegisterDeviceAsync(CancellationToken cancellationToken = default)
    {
        var session = await _authStore.LoadAsync(cancellationToken);
        if (session is null || string.IsNullOrWhiteSpace(session.AccessToken))
        {
            return;
        }

        var settings = await _settingsService.LoadAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(settings.DeviceId))
        {
            settings.DeviceId = Guid.NewGuid().ToString("N");
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
                },
                cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
                if (body.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("sessionId", out var sessionId) &&
                    sessionId.ValueKind == JsonValueKind.String)
                {
                    SessionId = sessionId.GetString();
                    _logger.LogInformation("Device registered with backend (session {SessionId})", SessionId);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Device registration failed: {Message}", ex.Message);
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
        var baseUrl = string.IsNullOrWhiteSpace(settings.ServerUrl)
            ? DefaultServerUrl
            : settings.ServerUrl.TrimEnd('/');

        var session = await _authStore.LoadAsync(cancellationToken);
        if (session is null || string.IsNullOrWhiteSpace(session.AccessToken))
        {
            throw new InvalidOperationException("Not authenticated. Sign in to synchronize files.");
        }

        // Refresh the token early if it is close to expiry.
        if (session.ExpiresAt <= DateTimeOffset.UtcNow.AddMinutes(2))
        {
            var refreshed = await _authService.RefreshTokenAsync(session.RefreshToken, cancellationToken);
            if (refreshed is null)
            {
                throw new InvalidOperationException("Session expired and could not be refreshed.");
            }

            session = new AuthSession
            {
                AccessToken = refreshed.AccessToken,
                RefreshToken = refreshed.RefreshToken,
                Email = refreshed.Email,
                ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(refreshed.ExpiresIn)
            };
            await _authStore.SaveAsync(session, cancellationToken);
        }

        using var client = CreateHttpClient(baseUrl, session.AccessToken);

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
        content.Add(fileContent, "files", Path.GetFileName(job.FilePath));

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
        if (string.IsNullOrWhiteSpace(fileId))
        {
            _logger.LogInformation("No remote id recorded for {Path}; nothing to delete remotely.", job.FilePath);
            return;
        }

        using var response = await client.DeleteAsync($"/files/{fileId}", cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Delete failed ({response.StatusCode}): {await response.Content.ReadAsStringAsync(cancellationToken)}");
        }
    }

    private async Task MoveFileAsync(HttpClient client, SyncJob job, CancellationToken cancellationToken)
    {
        var fileId = ExtractFileId(job.Payload);
        if (string.IsNullOrWhiteSpace(fileId))
        {
            // No remote reference yet — treat as a fresh upload instead.
            await UploadFileAsync(client, job, cancellationToken);
            return;
        }

        using var response = await client.PostAsJsonAsync(
            $"/files/{fileId}/move",
            new { toFolderId = (string?)null },
            cancellationToken);
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
