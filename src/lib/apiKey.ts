/**
 * Storage API key — deliberately NOT hardcoded.
 *
 * Until 2026-08-02 the master key sat as a literal in 15 source files and thus
 * inside the shipped JS bundle, readable by every visitor: full read/write/
 * delete across all tenants. A browser app cannot keep a secret, so the key is
 * simply gone from the build.
 *
 * Reading works without it: /storage/list, /storage/objects/{id} and
 * /storage/media/{id} all serve public objects keylessly. Only write and admin
 * actions still need a key — an operator can put one into localStorage
 * ("storage_api_key") for the session, and nothing ships in the bundle.
 */
export function getApiKey(): string {
  try {
    return localStorage.getItem('storage_api_key') || ''
  } catch {
    return ''
  }
}

/** Auth headers, or {} when no key is configured — safe on public endpoints. */
export function authHeaders(): Record<string, string> {
  const k = getApiKey()
  return k ? { 'X-API-KEY': k } : {}
}
