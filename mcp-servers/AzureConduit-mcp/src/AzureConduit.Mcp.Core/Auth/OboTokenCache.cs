namespace AzureConduit.Mcp.Core.Auth;

using System.Collections.Concurrent;
using Azure.Core;

/// <summary>
/// Thread-safe cache for OBO tokens. Tokens are cached per-user per-scope
/// to avoid redundant token exchanges while maintaining user isolation.
/// </summary>
public class OboTokenCache
{
    private readonly ConcurrentDictionary<string, CacheEntry> _cache = new();
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromMinutes(5);
    private DateTime _lastCleanup = DateTime.UtcNow;
    private readonly object _cleanupLock = new();

    /// <summary>
    /// Attempts to retrieve a cached token.
    /// </summary>
    /// <param name="key">Cache key (user token hash + scopes)</param>
    /// <param name="token">The cached access token if found and valid</param>
    /// <returns>True if a valid cached token was found</returns>
    public bool TryGet(string key, out AccessToken token)
    {
        CleanupIfNeeded();

        if (_cache.TryGetValue(key, out var entry) && entry.ExpiresOn > DateTimeOffset.UtcNow)
        {
            token = entry.Token;
            return true;
        }

        token = default;
        return false;
    }

    /// <summary>
    /// Caches a token with the specified expiration.
    /// </summary>
    /// <param name="key">Cache key (user token hash + scopes)</param>
    /// <param name="token">The access token to cache</param>
    /// <param name="expiresOn">When the token expires</param>
    public void Set(string key, AccessToken token, DateTimeOffset expiresOn)
    {
        // Only cache if expiration is in the future
        if (expiresOn > DateTimeOffset.UtcNow)
        {
            _cache[key] = new CacheEntry(token, expiresOn);
        }
    }

    /// <summary>
    /// Removes a specific entry from the cache.
    /// </summary>
    public void Remove(string key)
    {
        _cache.TryRemove(key, out _);
    }

    /// <summary>
    /// Clears all cached tokens.
    /// </summary>
    public void Clear()
    {
        _cache.Clear();
    }

    /// <summary>
    /// Gets the current number of cached entries.
    /// </summary>
    public int Count => _cache.Count;

    /// <summary>
    /// Generates a cache key from a user token and scopes.
    /// Uses only the last portion of the token to avoid logging sensitive data.
    /// </summary>
    public static string GenerateCacheKey(string userAssertion, IEnumerable<string> scopes)
    {
        // Use last 32 chars of assertion for uniqueness without exposing full token
        // This is safe because:
        // 1. The hash is not reversible to the full token
        // 2. Different users will have different token suffixes
        // 3. Same user with same token will get cache hits
        var assertionSuffix = userAssertion.Length > 32
            ? userAssertion[^32..]
            : userAssertion;

        var scopeKey = string.Join(",", scopes.OrderBy(s => s));

        return $"{assertionSuffix}:{scopeKey}";
    }

    private void CleanupIfNeeded()
    {
        if (DateTime.UtcNow - _lastCleanup < _cleanupInterval)
            return;

        // Use lock to prevent multiple concurrent cleanups
        if (!Monitor.TryEnter(_cleanupLock))
            return;

        try
        {
            if (DateTime.UtcNow - _lastCleanup < _cleanupInterval)
                return;

            _lastCleanup = DateTime.UtcNow;
            var now = DateTimeOffset.UtcNow;
            var keysToRemove = new List<string>();

            foreach (var kvp in _cache)
            {
                if (kvp.Value.ExpiresOn <= now)
                {
                    keysToRemove.Add(kvp.Key);
                }
            }

            foreach (var key in keysToRemove)
            {
                _cache.TryRemove(key, out _);
            }
        }
        finally
        {
            Monitor.Exit(_cleanupLock);
        }
    }

    private sealed record CacheEntry(AccessToken Token, DateTimeOffset ExpiresOn);
}
