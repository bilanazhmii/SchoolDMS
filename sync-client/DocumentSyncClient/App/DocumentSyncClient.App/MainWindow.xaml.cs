using System.Windows;
using DocumentSyncClient.Features.Login;
using Microsoft.Win32;

namespace DocumentSyncClient.App;

/// <summary>
/// Main window for the application shell.
/// </summary>
public partial class MainWindow : Window
{
    /// <summary>
    /// Initializes a new instance of the <see cref="MainWindow"/> class.
    /// </summary>
    public MainWindow(LoginViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
        viewModel.FolderPicker = PickFolder;
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
}
