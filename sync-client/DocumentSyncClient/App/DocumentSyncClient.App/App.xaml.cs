using System.IO;
using System.Windows;
using DocumentSyncClient.Core.Interfaces;
using DocumentSyncClient.Features.Login;
using DocumentSyncClient.Features.Sync;
using DocumentSyncClient.Infrastructure.Api;
using DocumentSyncClient.Infrastructure.Authentication;
using DocumentSyncClient.Infrastructure.Configuration;
using DocumentSyncClient.Infrastructure.FileWatcher;
using DocumentSyncClient.Infrastructure.Queue;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace DocumentSyncClient.App;

/// <summary>
/// Application startup class.
/// </summary>
public partial class App : System.Windows.Application
{
    private IHost? _host;
    private static readonly string StartupLogPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DocumentSyncClient", "startup.log");

    private static void LogStartup(string message)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(StartupLogPath)!);
            File.AppendAllText(StartupLogPath, $"[{DateTimeOffset.Now:O}] {message}{Environment.NewLine}");
        }
        catch { /* logging must never prevent startup */ }
    }

    /// <inheritdoc />
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        LogStartup("OnStartup entered");

        DispatcherUnhandledException += (_, args) =>
        {
            System.Windows.MessageBox.Show($"The sync client recovered from an error:\n\n{args.Exception.Message}", "DocumentSyncClient", MessageBoxButton.OK, MessageBoxImage.Warning);
            args.Handled = true;
        };

        try
        {
        LogStartup("Building host");
        _host = Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                services.AddSingleton<IAppSettingsService, JsonSettingsService>();
                services.AddSingleton<IAuthenticationStore, FileAuthStore>();
                services.AddSingleton<ISyncQueue, SqliteSyncQueue>();
                services.AddSingleton<ISyncEngine, SyncEngine>();
                services.AddSingleton<IFileMonitorService, FileMonitorService>();
                services.AddHttpClient<IAuthenticationService, AuthApiService>(client =>
                {
                    // Base URL is resolved from current settings on every call
                    // (see AuthApiService), so UI changes apply without restart.
                    client.Timeout = TimeSpan.FromSeconds(30);
                });
                services.AddSingleton<LoginViewModel>();
                services.AddSingleton<MainWindow>();
            })
            .Build();
        LogStartup("Host built");

        var settings = await _host.Services.GetRequiredService<IAppSettingsService>().LoadAsync();
        LogStartup($"Settings loaded: server={settings.ServerUrl}, folder={settings.SyncFolder}");
        var syncEngine = _host.Services.GetRequiredService<ISyncEngine>();
        await syncEngine.StartAsync();
        LogStartup("Sync engine started");

        var folders = new[] { settings.SyncFolder }
            .Concat(settings.SyncFolders ?? [])
            .Where(p => !string.IsNullOrWhiteSpace(p) && Directory.Exists(p))
            .Distinct(StringComparer.OrdinalIgnoreCase);
        var monitor = _host.Services.GetRequiredService<IFileMonitorService>();
        foreach (var folder in folders)
        {
            await monitor.StartAsync(folder);
            LogStartup($"File monitor started for {folder}");
        }

        var mainWindow = _host.Services.GetRequiredService<MainWindow>();
        LogStartup("MainWindow resolved");
        mainWindow.Show();
        mainWindow.Activate();
        LogStartup("MainWindow shown");
        }
        catch (Exception ex)
        {
            LogStartup($"Startup failed: {ex}");
            System.Windows.MessageBox.Show($"The sync client could not start its background services.\n\n{ex.Message}\n\nYou can still open the app and correct settings.", "DocumentSyncClient", MessageBoxButton.OK, MessageBoxImage.Warning);
            var mainWindow = _host?.Services.GetService<MainWindow>();
            mainWindow?.Show();
        }
    }

    /// <inheritdoc />
    protected override void OnExit(ExitEventArgs e)
    {
        _host?.Dispose();
        base.OnExit(e);
    }
}

