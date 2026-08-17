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
        if (!File.Exists(_filePath))
        {
            return null;
        }

        var json = await File.ReadAllTextAsync(_filePath, cancellationToken);
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        return JsonSerializer.Deserialize<AuthSession>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    /// <inheritdoc />
    public async Task SaveAsync(AuthSession session, CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(session, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(_filePath, json, cancellationToken);
    }

    /// <inheritdoc />
    public Task ClearAsync(CancellationToken cancellationToken = default)
    {
        if (File.Exists(_filePath))
        {
            File.Delete(_filePath);
        }

        return Task.CompletedTask;
    }
}
