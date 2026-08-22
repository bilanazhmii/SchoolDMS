namespace DocumentSyncClient.Core.Models;

/// <summary>
/// Represents the persisted user settings for the sync client.
/// </summary>
public sealed class AppSettings
{
    /// <summary>
    /// Gets or sets the backend server URL.
    /// </summary>
    public string ServerUrl { get; set; } = "http://localhost:3000";

    /// <summary>
    /// Gets or sets the local folder that will be synchronized.
    /// Kept for backward compatibility with older settings files.
    /// </summary>
    public string SyncFolder { get; set; } = string.Empty;

    /// <summary>
    /// Gets the additional folders that should be synchronized.
    /// Combined with <see cref="SyncFolder"/> at runtime.
    /// </summary>
    public List<string> SyncFolders { get; set; } = [];

    /// <summary>
    /// Gets or sets a value indicating whether the client should start with Windows.
    /// </summary>
    public bool AutoStartWindows { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether synchronization is enabled by default.
    /// </summary>
    public bool AutoSync { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether desktop notifications are enabled.
    /// </summary>
    public bool NotificationEnabled { get; set; } = true;

    /// <summary>
    /// Gets or sets the selected UI theme.
    /// </summary>
    public string Theme { get; set; } = "Light";

    /// <summary>
    /// Gets or sets a value indicating whether login credentials should be remembered.
    /// </summary>
    public bool RememberLogin { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether the user should be automatically signed in.
    /// </summary>
    public bool AutoLogin { get; set; }

    /// <summary>
    /// Gets or sets a stable device identifier used for backend heartbeats.
    /// </summary>
    public string DeviceId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the server remote-change cursor last applied locally.
    /// </summary>
        public string RemoteSyncCursor { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the signature of the active local target folders.
    /// Changing targets resets the remote cursor so re-enabled folders can replay safely.
    /// </summary>
    public string SyncTargetSignature { get; set; } = string.Empty;

}
