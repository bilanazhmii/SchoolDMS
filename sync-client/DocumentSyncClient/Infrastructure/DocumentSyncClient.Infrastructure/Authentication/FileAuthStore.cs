using System.Text.Json;
using DocumentSyncClient.Core.Interfaces;
using DocumentSyncClient.Core.Models;

namespace DocumentSyncClient.Infrastructure.Authentication;

/// <summary>
/// Stores auth sessions as JSON in the local application data directory.
/// </summary>
public sealed class FileAuthStore : IAuthenticationStore
{
    private readonly string _filePath;
    private readonly SemaphoreSlim _gate = new(1, 1);

    /// <summary>
    /// Initializes a new instance of the <see cref="FileAuthStore"/> class.
    /// </summary>
    public FileAuthStore()
    {
        var appDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DocumentSyncClient");
        Directory.CreateDirectory(appDataFolder);
        _filePath = Path.Combine(appDataFolder, "auth.json");
    }

    /// <inheritdoc />
    public async Task<AuthSession?> LoadAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (!File.Exists(_filePath)) return null;
            var json = await File.ReadAllTextAsync(_filePath, cancellationToken);
            if (string.IsNullOrWhiteSpace(json)) return null;
            return JsonSerializer.Deserialize<AuthSession>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException)
        {
            return null;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <inheritdoc />
    public async Task SaveAsync(AuthSession session, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var json = JsonSerializer.Serialize(session, new JsonSerializerOptions { WriteIndented = true });
            var tempPath = _filePath + ".tmp";
            await File.WriteAllTextAsync(tempPath, json, cancellationToken);
            File.Move(tempPath, _filePath, true);
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <inheritdoc />
    public async Task ClearAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (File.Exists(_filePath)) File.Delete(_filePath);
            var tempPath = _filePath + ".tmp";
            if (File.Exists(tempPath)) File.Delete(tempPath);
        }
        finally
        {
            _gate.Release();
        }
    }

}
