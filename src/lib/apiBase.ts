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

/**
 * Canonical thumbnail URL for a gallery tile.
 *
 * Deliberately built from the ID instead of trusting `item.thumbnail_url`:
 * the server emits that field WITHOUT `format=jpg`, which yields a PNG
 * derivative (~73 KB vs ~15 KB) and — because `format` is part of the cache
 * key — populates a second, redundant cache. Worse, callers used
 * `item.file_url` as a fallback, i.e. the ORIGINAL image (1 MB+ at 2560x1440),
 * which is what made tiles time out and render as broken images in the grid
 * (2026-08-02). One URL shape here = one cache entry, ~15 KB per tile.
 */
export function thumbUrl(item: { id: number | string; checksum?: string }): string {
  const v = item.checksum ? `&v=${item.checksum}` : ''
  return `${API_BASE_URL}/storage/media/${item.id}?variant=thumbnail&format=jpg${v}`
}
