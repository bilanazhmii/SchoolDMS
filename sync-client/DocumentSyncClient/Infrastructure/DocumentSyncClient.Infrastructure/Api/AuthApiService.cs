using System.Net.Http.Json;
using DocumentSyncClient.Core.DTO;
using DocumentSyncClient.Core.Interfaces;

namespace DocumentSyncClient.Infrastructure.Api;

/// <summary>
/// Implements authentication API operations against the backend.
/// The server URL is read from current settings on every call, so changes
/// made in the UI are applied immediately (no app restart required).
/// </summary>
public sealed class AuthApiService : IAuthenticationService
{
    private const string DefaultServerUrl = "http://localhost:3000";

    private readonly HttpClient _httpClient;
    private readonly IAuthenticationStore _authStore;
    private readonly IAppSettingsService _settingsService;

    /// <summary>
    /// Initializes a new instance of the <see cref="AuthApiService"/> class.
    /// </summary>
    public AuthApiService(
        HttpClient httpClient,
        IAuthenticationStore authStore,
        IAppSettingsService settingsService)
    {
        _httpClient = httpClient;
        _authStore = authStore;
        _settingsService = settingsService;
    }

    private async Task<string> ResolveBaseUrlAsync(CancellationToken cancellationToken)
    {
        var settings = await _settingsService.LoadAsync(cancellationToken);
        return (string.IsNullOrWhiteSpace(settings.ServerUrl)
            ? DefaultServerUrl
            : settings.ServerUrl).TrimEnd('/');
    }

    /// <inheritdoc />
    public async Task<LoginResponseDto?> SignInAsync(LoginRequestDto request, CancellationToken cancellationToken = default)
    {
        var baseUrl = await ResolveBaseUrlAsync(cancellationToken);
        var response = await _httpClient.PostAsJsonAsync($"{baseUrl}/auth/login", request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"Login failed ({response.StatusCode}): {error}");
        }

        return await response.Content.ReadFromJsonAsync<LoginResponseDto>(cancellationToken: cancellationToken);
    }

    /// <inheritdoc />
    public async Task<LoginResponseDto?> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var baseUrl = await ResolveBaseUrlAsync(cancellationToken);
        var response = await _httpClient.PostAsJsonAsync($"{baseUrl}/auth/refresh", new RefreshTokenRequestDto { RefreshToken = refreshToken }, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"Refresh failed ({response.StatusCode}): {error}");
        }

        return await response.Content.ReadFromJsonAsync<LoginResponseDto>(cancellationToken: cancellationToken);
    }

    /// <inheritdoc />
    public async Task SignOutAsync(CancellationToken cancellationToken = default)
    {
        await _authStore.ClearAsync(cancellationToken);
    }
}
