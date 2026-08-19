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
        IAppSettingsService settingsService)
    {
        _authenticationService = authenticationService;
        _authenticationStore = authenticationStore;
        _settingsService = settingsService;
        SignInCommand = new AsyncRelayCommand(SignInAsync);
        BrowseFolderCommand = new RelayCommand(BrowseFolder);
        SaveSettingsCommand = new AsyncRelayCommand(SaveSettingsAsync);
        _ = LoadSettingsAsync();
    }

    /// <summary>
    /// Gets the sign-in command.
    /// </summary>
    public IAsyncRelayCommand SignInCommand { get; }
    public IRelayCommand BrowseFolderCommand { get; }
    public IAsyncRelayCommand SaveSettingsCommand { get; }
    public Action? FolderPicker { get; set; }
    public string ServerUrl { get => _serverUrl; set { if (_serverUrl == value) return; _serverUrl = value; OnPropertyChanged(); } }
    public string SyncFolder { get => _syncFolder; set { if (_syncFolder == value) return; _syncFolder = value; OnPropertyChanged(); } }
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
            var result = await _authenticationService.SignInAsync(new LoginRequestDto { Email = Email, Password = Password });
            if (result is null)
            {
                Status = "Login failed. Please verify your credentials.";
                return;
            }

            var settings = await _settingsService.LoadAsync();
            settings.RememberLogin = RememberLogin;
            settings.AutoLogin = RememberLogin;
            await _settingsService.SaveAsync(settings);

            await _authenticationStore.SaveAsync(new Core.Models.AuthSession
            {
                AccessToken = result.AccessToken,
                RefreshToken = result.RefreshToken,
                Email = result.Email,
                ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(result.ExpiresIn)
            });

            Status = "Signed in successfully.";
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

    private async Task LoadSettingsAsync()
    {
        var settings = await _settingsService.LoadAsync();
        ServerUrl = string.IsNullOrWhiteSpace(settings.ServerUrl) ? ServerUrl : settings.ServerUrl;
        SyncFolder = settings.SyncFolder;
        AutoSync = settings.AutoSync;
        AutoStartWindows = settings.AutoStartWindows;
        RememberLogin = settings.RememberLogin;
    }

    private void BrowseFolder()
    {
        FolderPicker?.Invoke();
    }

    private async Task SaveSettingsAsync()
    {
        var settings = await _settingsService.LoadAsync();
        settings.ServerUrl = ServerUrl.Trim().TrimEnd('/');
        settings.SyncFolder = SyncFolder.Trim();
        settings.AutoSync = AutoSync;
        settings.AutoStartWindows = AutoStartWindows;
        settings.RememberLogin = RememberLogin;
        settings.AutoLogin = RememberLogin;
        if (!string.IsNullOrWhiteSpace(settings.SyncFolder))
            Directory.CreateDirectory(settings.SyncFolder);
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
