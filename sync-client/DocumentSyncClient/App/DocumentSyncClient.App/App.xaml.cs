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
public partial class App : Application
{
    private IHost? _host;

    /// <inheritdoc />
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        _host = Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                services.AddSingleton<IAppSettingsService, JsonSettingsService>();
                services.AddSingleton<IAuthenticationStore, FileAuthStore>();
                services.AddSingleton<ISyncQueue, SqliteSyncQueue>();
                services.AddSingleton<ISyncEngine, SyncEngine>();
                services.AddSingleton<IFileMonitorService, FileMonitorService>();
                services.AddHttpClient<IAuthenticationService, AuthApiService>((sp, client) =>
                {
                    var settings = sp.GetRequiredService<IAppSettingsService>().LoadAsync().GetAwaiter().GetResult();
                    client.BaseAddress = new Uri(settings.ServerUrl);
                    client.Timeout = TimeSpan.FromSeconds(30);
                });
                services.AddSingleton<LoginViewModel>();
                services.AddSingleton<MainWindow>();
            })
            .Build();

        var settings = await _host.Services.GetRequiredService<IAppSettingsService>().LoadAsync();
        var syncEngine = _host.Services.GetRequiredService<ISyncEngine>();
        await syncEngine.StartAsync();

        if (!string.IsNullOrWhiteSpace(settings.SyncFolder) && Directory.Exists(settings.SyncFolder))
        {
            var monitor = _host.Services.GetRequiredService<IFileMonitorService>();
            await monitor.StartAsync(settings.SyncFolder);
        }

        var mainWindow = _host.Services.GetRequiredService<MainWindow>();
        mainWindow.Show();
    }

    /// <inheritdoc />
    protected override void OnExit(ExitEventArgs e)
    {
        _host?.Dispose();
        base.OnExit(e);
    }
}

