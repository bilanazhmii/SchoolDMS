using System.Windows;
using DocumentSyncClient.Features.Login;
using Microsoft.Win32;

namespace DocumentSyncClient.App;

/// <summary>
/// Main window for the application shell.
/// </summary>
public partial class MainWindow : Window
{
    private readonly System.Windows.Forms.NotifyIcon _trayIcon;
    private bool _allowClose;
    /// <summary>
    /// Initializes a new instance of the <see cref="MainWindow"/> class.
    /// </summary>
    public MainWindow(LoginViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
        viewModel.FolderPicker = PickFolder;
        _trayIcon = new System.Windows.Forms.NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Application,
            Text = "SchoolDMS Sync",
            Visible = true,
            ContextMenuStrip = new System.Windows.Forms.ContextMenuStrip()
        };
        _trayIcon.ContextMenuStrip.Items.Add("Open", null, (_, _) => ShowFromTray());
        _trayIcon.ContextMenuStrip.Items.Add("Exit", null, (_, _) => { _allowClose = true; Close(); });
        _trayIcon.DoubleClick += (_, _) => ShowFromTray();
    }

    private void PickFolder()
    {
        var dialog = new OpenFolderDialog { Title = "Choose the folder to synchronize" };
        if (dialog.ShowDialog() == true && DataContext is LoginViewModel viewModel)
            viewModel.SyncFolder = dialog.FolderName;
    }

    private void PasswordInput_OnPasswordChanged(object sender, System.Windows.RoutedEventArgs e)
    {
        if (DataContext is LoginViewModel viewModel && sender is System.Windows.Controls.PasswordBox passwordBox)
            viewModel.Password = passwordBox.Password;
    }

    private void Window_OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (_allowClose) { _trayIcon.Visible = false; _trayIcon.Dispose(); return; }
        e.Cancel = true;
        Hide();
        _trayIcon.ShowBalloonTip(2000, "SchoolDMS Sync", "Sync is still running in the background.", System.Windows.Forms.ToolTipIcon.Info);
    }

    private void ShowFromTray()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }
}
