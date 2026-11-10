/**
 * internize.ai — In-App Update Checker Service
 *
 * Strict Zero Egress Invariant:
 * Only performs a simple GET fetch to the static version.json manifest.
 * Zero patient data (PHI) or query telemetry is ever attached.
 */

export interface VersionInfo {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  minExtensionVersion?: string;
  changelog?: string[];
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  versionInfo?: VersionInfo;
  error?: string;
}

export const CURRENT_APP_VERSION = '2.2.0';
const DISMISSED_UPDATE_KEY_PREFIX = 'internize_dismissed_update_v';

/**
 * Compare two semver version strings (e.g., '2.3.0' vs '2.2.0').
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = (v1 || '').replace(/^v/i, '').trim();
  const clean2 = (v2 || '').replace(/^v/i, '').trim();

  const parts1 = clean1.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => Number.parseInt(p, 10) || 0);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

/**
 * Returns the default manifest endpoint URL based on the runtime context.
 * In Chrome extension environment, queries the public Vercel production manifest.
 * In Web app environment, uses the relative path /version.json.
 */
export function getDefaultUpdateEndpoint(): string {
  if (typeof window !== 'undefined' && window.location?.protocol === 'chrome-extension:') {
    return 'https://internize-ai.vercel.app/version.json';
  }
  return '/version.json';
}

/**
 * Resolves a download URL for the extension package.
 * When invoked inside a Chrome extension context, relative paths are mapped
 * to the remote production domain (https://internize-ai.vercel.app).
 */
export function resolveDownloadUrl(url = '/internize-ai-extension.zip'): string {
  if (typeof window !== 'undefined' && window.location?.protocol === 'chrome-extension:') {
    if (url.startsWith('/')) {
      return `https://internize-ai.vercel.app${url}`;
    }
  }
  return url;
}

/**
 * Checks for updates against the static version.json file.
 */
export async function checkForUpdate(
  currentVersion: string = CURRENT_APP_VERSION,
  endpointUrl: string = getDefaultUpdateEndpoint(),
): Promise<UpdateCheckResult> {
  try {
    const res = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-cache',
    });

    if (!res.ok) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data: VersionInfo = await res.json();
    if (!data || !data.version) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        error: 'Invalid version manifest payload',
      };
    }

    const hasNewer = compareVersions(data.version, currentVersion) > 0;

    return {
      updateAvailable: hasNewer,
      currentVersion,
      latestVersion: data.version,
      versionInfo: data,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to check for updates';
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      error: errorMsg,
    };
  }
}

/**
 * Dismiss an update version for the current browser session or persistence.
 */
export function dismissUpdate(version: string): void {
  try {
    localStorage.setItem(`${DISMISSED_UPDATE_KEY_PREFIX}${version}`, 'true');
  } catch {}
}

/**
 * Check if a specific version update prompt was previously dismissed.
 */
export function isUpdateDismissed(version: string): boolean {
  try {
    return localStorage.getItem(`${DISMISSED_UPDATE_KEY_PREFIX}${version}`) === 'true';
  } catch {
    return false;
  }
}
