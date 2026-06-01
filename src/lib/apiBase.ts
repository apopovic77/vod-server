// Runtime-resolved storage-api base URL.
//
// The CI builds ONE bundle and deploys it to BOTH hosts:
//   - production  → vod.arkturian.com            (VPS)
//   - staging     → vod.arkserver.arkturian.com  (arkserver)
// A single build can't bake in a per-host value, so we derive the storage-api
// base from the serving hostname at runtime instead of hardcoding the VPS URL.
//
// Mapping: vod.<rest> → api-storage.<rest>
//   vod.arkturian.com            → api-storage.arkturian.com
//   vod.arkserver.arkturian.com  → api-storage.arkserver.arkturian.com
//
// An explicit VITE_API_BASE_URL (build-time) still wins — useful for local dev
// or pinning a build to a specific backend.

function resolveApiBase(): string {
  const override = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (override) return override

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host.startsWith('vod.')) {
      return `https://api-storage.${host.slice(4)}`
    }
  }

  // Dev / non-vod host fallback
  return 'https://api-storage.arkturian.com'
}

export const API_BASE_URL: string = resolveApiBase()
