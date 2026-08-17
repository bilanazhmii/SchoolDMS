using System.Windows;
using DocumentSyncClient.Features.Login;

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
    }
}