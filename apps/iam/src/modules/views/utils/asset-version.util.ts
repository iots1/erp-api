import { readFileSync } from 'fs';
import { join } from 'path';

interface BuildManifest {
  version: string;
}

let cachedVersion: string | null = null;

/**
 * Cache-busting `?v=` value for <link>/<script> tags, read from the manifest
 * apps/iam/build-assets.mjs writes after bundling. Falls back to the process
 * boot time if the manifest is missing (assets not built yet) so links still
 * change across restarts instead of caching indefinitely.
 */
export function getAssetVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    const manifestPath = join(
      process.cwd(),
      'apps/iam/dist/public/build-manifest.json',
    );
    const manifest = JSON.parse(
      readFileSync(manifestPath, 'utf-8'),
    ) as BuildManifest;
    cachedVersion = manifest.version;
  } catch {
    cachedVersion = String(Date.now());
  }

  return cachedVersion;
}
