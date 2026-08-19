using System.Net.Http.Json;
using DocumentSyncClient.Core.DTO;
using DocumentSyncClient.Core.Interfaces;

namespace DocumentSyncClient.Infrastructure.Api;

/// <summary>
/// Implements authentication API operations against the backend.
/// </summary>
public sealed class AuthApiService : IAuthenticationService
{
    private readonly HttpClient _httpClient;
    private readonly IAuthenticationStore _authStore;

    /// <summary>
    /// Initializes a new instance of the <see cref="AuthApiService"/> class.
    /// </summary>
    public AuthApiService(HttpClient httpClient, IAuthenticationStore authStore)
    {
        _httpClient = httpClient;
        _authStore = authStore;
    }

    /// <inheritdoc />
    public async Task<LoginResponseDto?> SignInAsync(LoginRequestDto request, CancellationToken cancellationToken = default)
    {
        var response = await _httpClient.PostAsJsonAsync("/auth/login", request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                throw new UnauthorizedAccessException("Server terhubung, tetapi email atau password ditolak. Gunakan kredensial yang sama seperti web SchoolDMS.");
            throw new HttpRequestException($"Login failed ({response.StatusCode}): {error}");
        }

        return await response.Content.ReadFromJsonAsync<LoginResponseDto>(cancellationToken: cancellationToken);
    }

    /// <inheritdoc />
    public async Task<LoginResponseDto?> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var response = await _httpClient.PostAsJsonAsync("/auth/refresh", new RefreshTokenRequestDto { RefreshToken = refreshToken }, cancellationToken);
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
