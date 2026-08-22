using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Runtime.Versioning;
using Microsoft.Win32;
using CommunityToolkit.Mvvm.Input;
using DocumentSyncClient.Core.DTO;
using DocumentSyncClient.Core.Interfaces;

namespace DocumentSyncClient.Features.Login;

/// <summary>
/// View model for the login screen.
/// </summary>
public sealed class LoginViewModel : INotifyPropertyChanged
{
    private readonly IAuthenticationService _authenticationService;
    private readonly IAuthenticationStore _authenticationStore;
    private readonly IAppSettingsService _settingsService;
    private readonly ISyncEngine _syncEngine;
    private readonly IFileMonitorService _fileMonitorService;
    private string _email = string.Empty;
    private string _password = string.Empty;
    private string _status = "Please sign in to continue.";
    private bool _isBusy;
    private bool _rememberLogin;
    private string _serverUrl = "https://schooldms-production.up.railway.app";
    private string _syncFolder = string.Empty;
    private bool _autoSync = true;
    private bool _autoStartWindows;

    /// <summary>
    /// Initializes a new instance of the <see cref="LoginViewModel"/> class.
    /// </summary>
    public LoginViewModel(
        IAuthenticationService authenticationService,
        IAuthenticationStore authenticationStore,
        IAppSettingsService settingsService,
        ISyncEngine syncEngine,
        IFileMonitorService fileMonitorService)
    {
        _authenticationService = authenticationService;
        _authenticationStore = authenticationStore;
        _settingsService = settingsService;
        _syncEngine = syncEngine;
        _fileMonitorService = fileMonitorService;
        SignInCommand = new AsyncRelayCommand(SignInAsync);
        BrowseFolderCommand = new RelayCommand(BrowseFolder);
        AddFolderCommand = new RelayCommand(AddFolder);
        RemoveFolderCommand = new RelayCommand<string>(RemoveFolder);
        SaveSettingsCommand = new AsyncRelayCommand(SaveSettingsAsync);
        _syncEngine.JobProcessed += (_, success) =>
        {
            if (success) SyncedCount++;
            else FailedCount++;
            LastSyncAt = DateTimeOffset.Now;
            OnPropertyChanged(nameof(SyncedCount));
            OnPropertyChanged(nameof(FailedCount));
            OnPropertyChanged(nameof(LastSyncAt));
            OnPropertyChanged(nameof(StatusLine));
        };

    }

    /// <summary>
    /// Loads persisted settings and resumes a remembered session when enabled.
    /// </summary>
    public async Task InitializeAsync()
    {
        await LoadSettingsAsync();
        if (!RememberLogin)
        {
            Status = "Ready. Sign in to start synchronization.";
            return;
        }

        var session = await _authenticationStore.LoadAsync();
        if (session is null || string.IsNullOrWhiteSpace(session.RefreshToken))
        {
            Status = "Remembered account is unavailable. Please sign in again.";
            return;
        }

        try
        {
            if (session.ExpiresAt <= DateTimeOffset.UtcNow.AddMinutes(2))
            {
                var refreshed = await _authenticationService.RefreshTokenAsync(session.RefreshToken);
                if (refreshed is null) throw new InvalidOperationException("The remembered session could not be refreshed.");
                session = new Core.Models.AuthSession
                {
                    AccessToken = refreshed.AccessToken,
                    RefreshToken = refreshed.RefreshToken,
                    Email = refreshed.Email,
                    ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(refreshed.ExpiresIn),
                };
                await _authenticationStore.SaveAsync(session);
            }

            Email = session.Email;
            IsSignedIn = true;
            ConnectedEmail = session.Email;
            OnPropertyChanged(nameof(IsSignedIn));
            OnPropertyChanged(nameof(ConnectedEmail));
            OnPropertyChanged(nameof(StatusLine));
            await StartBackgroundSyncAsync();
            Status = "Remembered account restored. Synchronization is running in the background.";
        }
        catch (Exception ex)
        {
            await _authenticationStore.ClearAsync();
            IsSignedIn = false;
            ConnectedEmail = string.Empty;
            OnPropertyChanged(nameof(IsSignedIn));
            OnPropertyChanged(nameof(ConnectedEmail));
            OnPropertyChanged(nameof(StatusLine));
            Status = $"Remembered account needs sign-in again: {ex.Message}";
        }
    }

    /// <summary>
    /// Gets whether a user is currently signed in (live indicator).
    /// </summary>

    public bool IsSignedIn { get; private set; }

    /// <summary>
    /// Gets the email of the signed-in user.
    /// </summary>
    public string ConnectedEmail { get; private set; } = string.Empty;

    /// <summary>
    /// Gets the time of the last completed sync job.
    /// </summary>
    public DateTimeOffset? LastSyncAt { get; private set; }

    /// <summary>
    /// Gets the number of successfully synced files this session.
    /// </summary>
    public int SyncedCount { get; private set; }

    /// <summary>
    /// Gets the number of failed sync jobs this session.
    /// </summary>
    public int FailedCount { get; private set; }

    /// <summary>
    /// Human-readable connection/sync status for the UI.
    /// </summary>
    public string StatusLine => IsSignedIn
        ? $"Connected as {ConnectedEmail} · {SyncedCount} synced · {FailedCount} failed" +
          (LastSyncAt.HasValue ? $" · last sync {LastSyncAt.Value.ToLocalTime():HH:mm:ss}" : string.Empty)
        : "Not connected — sign in to synchronize.";

    /// <summary>
    /// Gets the sign-in command.
    /// </summary>
    public IAsyncRelayCommand SignInCommand { get; }
    public IRelayCommand BrowseFolderCommand { get; }
    public IRelayCommand AddFolderCommand { get; }
    public IRelayCommand<string> RemoveFolderCommand { get; }
    public IAsyncRelayCommand SaveSettingsCommand { get; }
    public Action? FolderPicker { get; set; }
    public string ServerUrl { get => _serverUrl; set { if (_serverUrl == value) return; _serverUrl = value; OnPropertyChanged(); } }
    public string SyncFolder { get => _syncFolder; set { if (_syncFolder == value) return; _syncFolder = value; OnPropertyChanged(); OnPropertyChanged(nameof(AllSyncFolders)); } }
    public System.Collections.ObjectModel.ObservableCollection<string> ExtraFolders { get; } = [];
        public IEnumerable<string> AllSyncFolders =>
        new[] { SyncFolder }.Concat(ExtraFolders).Where(p => !string.IsNullOrWhiteSpace(p)).Distinct(StringComparer.OrdinalIgnoreCase);

    public bool AutoSync { get => _autoSync; set { if (_autoSync == value) return; _autoSync = value; OnPropertyChanged(); } }
    public bool AutoStartWindows { get => _autoStartWindows; set { if (_autoStartWindows == value) return; _autoStartWindows = value; OnPropertyChanged(); } }

    /// <summary>
    /// Gets or sets the email address.
    /// </summary>
    public string Email
    {
        get => _email;
        set
        {
            if (_email == value) return;
            _email = value;
            OnPropertyChanged();
        }
    }

    /// <summary>
    /// Gets or sets the password.
    /// </summary>
    public string Password
    {
        get => _password;
        set
        {
            if (_password == value) return;
            _password = value;
            OnPropertyChanged();
        }
    }

    /// <summary>
    /// Gets or sets a value indicating whether login should be remembered.
    /// </summary>
    public bool RememberLogin
    {
        get => _rememberLogin;
        set
        {
            if (_rememberLogin == value) return;
            _rememberLogin = value;
            OnPropertyChanged();
        }
    }

    /// <summary>
    /// Gets or sets the status message.
    /// </summary>
    public string Status
    {
        get => _status;
        set
        {
            if (_status == value) return;
            _status = value;
            OnPropertyChanged();
        }
    }

    /// <summary>
    /// Gets or sets a value indicating whether the view model is busy.
    /// </summary>
    public bool IsBusy
    {
        get => _isBusy;
        set
        {
            if (_isBusy == value) return;
            _isBusy = value;
            OnPropertyChanged();
        }
    }

    /// <summary>
    /// Signs in the current user.
    /// </summary>
    public async Task SignInAsync()
    {
        if (IsBusy)
        {
            return;
        }

        IsBusy = true;
        Status = "Signing in...";

        try
        {
            // Persist the connection settings FIRST so the sign-in request
            // and all subsequent sync traffic use the URL typed in the UI.
                        var selectedFolders = GetSelectedFolders().ToList();
            if (selectedFolders.Any(folder => !IsValidHeadFolder(folder)))
            {
                Status = "Every target must be an existing folder below the drive root. The drive root itself cannot be synchronized.";
                return;
            }

            var selectedRoot = selectedFolders.FirstOrDefault() ?? string.Empty;
            var settings = await _settingsService.LoadAsync();
            settings.ServerUrl = ServerUrl.Trim().TrimEnd('/');
            settings.SyncFolder = selectedRoot;
            settings.SyncFolders = selectedFolders.Skip(1).ToList();

            settings.AutoSync = AutoSync;
            settings.AutoStartWindows = AutoStartWindows;
            settings.RememberLogin = RememberLogin;
            settings.AutoLogin = RememberLogin;
            foreach (var folder in selectedFolders)
                Directory.CreateDirectory(folder);
            await _settingsService.SaveAsync(settings);

            var result = await _authenticationService.SignInAsync(new LoginRequestDto { Email = Email, Password = Password });
            if (result is null)
            {
                Status = "Login failed. Please verify your credentials.";
                return;
            }

            await _authenticationStore.SaveAsync(new Core.Models.AuthSession
            {
                AccessToken = result.AccessToken,
                RefreshToken = result.RefreshToken,
                Email = result.Email,
                ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(result.ExpiresIn)
            });

            IsSignedIn = true;
            ConnectedEmail = result.Email;
            OnPropertyChanged(nameof(IsSignedIn));
            OnPropertyChanged(nameof(ConnectedEmail));
            OnPropertyChanged(nameof(StatusLine));

            await StartBackgroundSyncAsync();

        }
        catch (Exception ex)
        {
            Status = $"Sign in error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task StartBackgroundSyncAsync()
    {
        await _syncEngine.RegisterDeviceAsync();

        var folders = AllSyncFolders.Where(Directory.Exists).ToList();
        foreach (var folder in folders)
        {
            Directory.CreateDirectory(folder);
            await _syncEngine.SyncFolderAsync(folder);
            await _fileMonitorService.StartAsync(folder);
        }

        Status = folders.Count > 0
            ? $"Connected. Synchronizing {folders.Count} folder(s) in the background."
            : "Connected. Add one or more sync folders to begin background synchronization.";
    }

    private async Task LoadSettingsAsync()

    {
                var settings = await _settingsService.LoadAsync();
        settings.SyncFolders ??= [];
        ServerUrl = string.IsNullOrWhiteSpace(settings.ServerUrl) ? ServerUrl : settings.ServerUrl;
        SyncFolder = settings.SyncFolder;

        ExtraFolders.Clear();
        foreach (var folder in settings.SyncFolders.Where(p => !string.IsNullOrWhiteSpace(p) && !string.Equals(p, settings.SyncFolder, StringComparison.OrdinalIgnoreCase)))
            ExtraFolders.Add(folder);

        AutoSync = settings.AutoSync;
        AutoStartWindows = settings.AutoStartWindows;
        RememberLogin = settings.RememberLogin;
    }

    private void BrowseFolder()
    {
        FolderPicker?.Invoke();
    }

    private void AddFolder()
    {
        FolderPicker?.Invoke();
        if (string.IsNullOrWhiteSpace(SyncFolder)) return;
        if (ExtraFolders.Any(p => string.Equals(p, SyncFolder, StringComparison.OrdinalIgnoreCase))) return;
        ExtraFolders.Add(SyncFolder);
        OnPropertyChanged(nameof(AllSyncFolders));
    }

    private void RemoveFolder(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return;
        var match = ExtraFolders.FirstOrDefault(p => string.Equals(p, path, StringComparison.OrdinalIgnoreCase));
        if (match is not null) ExtraFolders.Remove(match);
        if (string.Equals(SyncFolder, path, StringComparison.OrdinalIgnoreCase))
            SyncFolder = ExtraFolders.FirstOrDefault() ?? string.Empty;
        OnPropertyChanged(nameof(AllSyncFolders));
    }

    private static bool IsValidHeadFolder(string path)
    {
        try
        {
            var fullPath = Path.GetFullPath(path.Trim());
            return Directory.Exists(fullPath) && !string.Equals(Path.GetPathRoot(fullPath), fullPath, StringComparison.OrdinalIgnoreCase);
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private IEnumerable<string> GetSelectedFolders()
        => new[] { SyncFolder }.Concat(ExtraFolders)
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(path => Path.GetFullPath(path.Trim()))
            .Distinct(StringComparer.OrdinalIgnoreCase);

    private async Task SaveSettingsAsync()
    {
        var selectedFolders = GetSelectedFolders().ToList();
        if (selectedFolders.Any(folder => !IsValidHeadFolder(folder)))
        {
            Status = "Every target must be an existing folder below the drive root. The drive root itself cannot be synchronized.";
            return;
        }

        var selectedRoot = selectedFolders.FirstOrDefault() ?? string.Empty;
        var settings = await _settingsService.LoadAsync();
        settings.ServerUrl = ServerUrl.Trim().TrimEnd('/');
        settings.SyncFolder = selectedRoot;
        settings.SyncFolders = selectedFolders.Skip(1).ToList();

        settings.AutoSync = AutoSync;
        settings.AutoStartWindows = AutoStartWindows;
        settings.RememberLogin = RememberLogin;
        settings.AutoLogin = RememberLogin;
                foreach (var folder in selectedFolders)
            Directory.CreateDirectory(folder);
        await _settingsService.SaveAsync(settings);

#pragma warning disable CA1416
        ConfigureStartup(AutoStartWindows);
#pragma warning restore CA1416
        Status = "Settings saved. Restart the app to apply folder monitoring changes.";
    }

    [SupportedOSPlatform("windows")]
    private static void ConfigureStartup(bool enabled)
    {
        using var key = Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run", writable: true)
            ?? Registry.CurrentUser.CreateSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
        const string name = "DocumentSyncClient";
        if (enabled) key?.SetValue(name, $"\"{Environment.ProcessPath}\"");
        else key?.DeleteValue(name, false);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
