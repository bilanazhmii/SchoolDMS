using System.Text.Json;
using DocumentSyncClient.Core.Interfaces;
using DocumentSyncClient.Core.Models;

namespace DocumentSyncClient.Infrastructure.Configuration;

/// <summary>
/// Persists settings to a JSON file in the application's data folder.
/// </summary>
public sealed class JsonSettingsService : IAppSettingsService
{
    private readonly string _filePath;

    /// <summary>
    /// Initializes a new instance of the <see cref="JsonSettingsService"/> class.
    /// </summary>
    public JsonSettingsService()
    {
        var appDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DocumentSyncClient");
        Directory.CreateDirectory(appDataFolder);
        _filePath = Path.Combine(appDataFolder, "settings.json");
    }

    /// <inheritdoc />
    public async Task<AppSettings> LoadAsync(CancellationToken cancellationToken = default)
    {
        if (!File.Exists(_filePath))
        {
            var defaults = new AppSettings();
            await SaveAsync(defaults, cancellationToken);
            return defaults;
        }

        var json = await File.ReadAllTextAsync(_filePath, cancellationToken).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(json))
        {
            return new AppSettings();
        }

        var settings = JsonSerializer.Deserialize<AppSettings>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        settings ??= new AppSettings();
        if (settings.ServerUrl.Contains("localhost", StringComparison.OrdinalIgnoreCase))
        {
            settings.ServerUrl = "https://schooldms-production.up.railway.app";
            await SaveAsync(settings, cancellationToken).ConfigureAwait(false);
        }
        return settings;
    }

    /// <inheritdoc />
    public async Task SaveAsync(AppSettings settings, CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(_filePath, json, cancellationToken).ConfigureAwait(false);
    }
}
