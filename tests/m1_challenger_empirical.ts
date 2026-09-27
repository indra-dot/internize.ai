import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_ROOT = process.cwd();
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

interface TestFailure {
  assertion: string;
  expected: any;
  actual: any;
  details?: string;
}

const failures: TestFailure[] = [];
let passCount = 0;

function assert(condition: boolean, assertionName: string, expected: any, actual: any, details?: string) {
  if (condition) {
    passCount++;
    console.log(`  [PASS] ${assertionName}`);
  } else {
    failures.push({ assertion: assertionName, expected, actual, details });
    console.error(`  [FAIL] ${assertionName}\n         Expected: ${JSON.stringify(expected)}\n         Actual:   ${JSON.stringify(actual)}${details ? `\n         Details:  ${details}` : ''}`);
  }
}

export function runEmpiricalAudit(): { passed: boolean; passCount: number; failureCount: number; failures: TestFailure[] } {
  console.log('\n======================================================');
  console.log('CHALLENGER M1: EMPIRICAL STRESS-TEST OF BUILD ARTIFACTS');
  console.log('======================================================\n');

  // 1. Manifest file existence
  const manifestPath = path.join(DIST_DIR, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'dist/manifest.json exists', true, fs.existsSync(manifestPath));
  if (!fs.existsSync(manifestPath)) {
    return { passed: false, passCount, failureCount: failures.length, failures };
  }

  // 2. Valid JSON parse
  let manifest: any = null;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
    assert(true, 'dist/manifest.json parses as valid JSON', 'valid JSON', 'valid JSON');
  } catch (err: any) {
    assert(false, 'dist/manifest.json parses as valid JSON', 'valid JSON', err.message);
    return { passed: false, passCount, failureCount: failures.length, failures };
  }

  // 3. Strict MV3 Rules Conformance
  assert(manifest.manifest_version === 3, 'manifest_version is 3', 3, manifest.manifest_version);
  assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'manifest.name is non-empty string', true, manifest.name);
  assert(typeof manifest.version === 'string' && /^\d+\.\d+\.\d+/.test(manifest.version), 'manifest.version is semver', true, manifest.version);

  // 4. Permissions check: strictly only ["sidePanel", "storage", "activeTab", "scripting"]
  const expectedPermissions = ['activeTab', 'scripting', 'sidePanel', 'storage'].sort();
  const actualPermissions = Array.isArray(manifest.permissions) ? [...manifest.permissions].sort() : [];
  const permissionsMatch = JSON.stringify(actualPermissions) === JSON.stringify(expectedPermissions);
  assert(
    permissionsMatch,
    'permissions contains only ["sidePanel", "storage", "activeTab", "scripting"]',
    expectedPermissions,
    actualPermissions
  );

  // 5. Host permissions check: NO <all_urls> or broad patterns in host_permissions
  const hostPermissions = manifest.host_permissions;
  let broadHostFound = false;
  if (Array.isArray(hostPermissions)) {
    broadHostFound = hostPermissions.some((p: string) =>
      p === '<all_urls>' || p === '*://*/*' || p === 'http://*/*' || p === 'https://*/*'
    );
  }
  assert(
    !broadHostFound && (hostPermissions === undefined || !hostPermissions.includes('<all_urls>')),
    'host_permissions contains NO <all_urls> or broad patterns',
    'no broad host permissions',
    hostPermissions || 'undefined'
  );

  // 6. Action configuration: default_title & default_icon present, default_popup UNDEFINED
  assert(typeof manifest.action?.default_title === 'string', 'action.default_title is defined', true, !!manifest.action?.default_title);
  assert(typeof manifest.action?.default_icon === 'object', 'action.default_icon is defined', true, !!manifest.action?.default_icon);
  assert(manifest.action?.default_popup === undefined, 'action.default_popup is undefined (single-click sidePanel)', undefined, manifest.action?.default_popup);

  // 7. Side panel configuration
  assert(manifest.side_panel?.default_path === 'sidepanel.html', 'side_panel.default_path is sidepanel.html', 'sidepanel.html', manifest.side_panel?.default_path);

  // 8. Background service worker configuration
  assert(typeof manifest.background?.service_worker === 'string', 'background.service_worker is defined', true, manifest.background?.service_worker);
  assert(manifest.background?.type === 'module', 'background.type is module', 'module', manifest.background?.type);

  // 9. Content Security Policy: wasm-unsafe-eval present, unsafe-eval absent
  const csp = manifest.content_security_policy?.extension_pages;
  assert(
    typeof csp === 'string' && csp.includes("'wasm-unsafe-eval'") && !csp.includes("'unsafe-eval'"),
    "CSP specifies 'wasm-unsafe-eval' and no remote eval",
    true,
    csp
  );

  // 10. Check all files referenced in dist/manifest.json exist and are non-empty (>0 bytes)
  const referencedFiles: { source: string; relPath: string }[] = [];

  // side_panel
  if (manifest.side_panel?.default_path) {
    referencedFiles.push({ source: 'side_panel.default_path', relPath: manifest.side_panel.default_path });
  }

  // background
  if (manifest.background?.service_worker) {
    referencedFiles.push({ source: 'background.service_worker', relPath: manifest.background.service_worker });
  }

  // icons
  if (manifest.icons && typeof manifest.icons === 'object') {
    for (const [size, iconRel] of Object.entries(manifest.icons)) {
      referencedFiles.push({ source: `icons.${size}`, relPath: iconRel as string });
    }
  }

  // action icons
  if (manifest.action?.default_icon && typeof manifest.action.default_icon === 'object') {
    for (const [size, iconRel] of Object.entries(manifest.action.default_icon)) {
      referencedFiles.push({ source: `action.default_icon.${size}`, relPath: iconRel as string });
    }
  }

  // content scripts
  if (Array.isArray(manifest.content_scripts)) {
    manifest.content_scripts.forEach((cs: any, i: number) => {
      if (Array.isArray(cs.js)) {
        cs.js.forEach((jsRel: string) => {
          referencedFiles.push({ source: `content_scripts[${i}].js`, relPath: jsRel });
        });
      }
      if (Array.isArray(cs.css)) {
        cs.css.forEach((cssRel: string) => {
          referencedFiles.push({ source: `content_scripts[${i}].css`, relPath: cssRel });
        });
      }
    });
  }

  // web accessible resources
  if (Array.isArray(manifest.web_accessible_resources)) {
    manifest.web_accessible_resources.forEach((war: any, i: number) => {
      if (Array.isArray(war.resources)) {
        war.resources.forEach((resRel: string) => {
          referencedFiles.push({ source: `web_accessible_resources[${i}]`, relPath: resRel });
        });
      }
    });
  }

  for (const ref of referencedFiles) {
    const full = path.join(DIST_DIR, ref.relPath);
    const exists = fs.existsSync(full);
    const stat = exists ? fs.statSync(full) : null;
    const nonEmpty = stat ? stat.size > 0 : false;
    assert(
      exists && nonEmpty,
      `Referenced file [${ref.source}] "${ref.relPath}" exists and is non-empty`,
      `exists with size > 0`,
      exists ? `exists (${stat?.size} bytes)` : 'NOT FOUND'
    );
  }

  // 11. Deep verification of dist/sidepanel.html
  const sidepanelHtmlPath = path.join(DIST_DIR, 'sidepanel.html');
  if (fs.existsSync(sidepanelHtmlPath)) {
    const html = fs.readFileSync(sidepanelHtmlPath, 'utf8');
    assert(html.includes('<div id="root"'), 'sidepanel.html contains <div id="root"', true, html.includes('<div id="root"'));
    
    // Check referenced script tags
    const scriptSrcMatches = Array.from(html.matchAll(/src=["']([^"']+)["']/g));
    for (const match of scriptSrcMatches) {
      let scriptRef = match[1];
      if (scriptRef.startsWith('/')) scriptRef = scriptRef.slice(1);
      const scriptFullPath = path.join(DIST_DIR, scriptRef);
      const exists = fs.existsSync(scriptFullPath);
      const size = exists ? fs.statSync(scriptFullPath).size : 0;
      assert(exists && size > 0, `sidepanel.html script "${scriptRef}" exists and non-empty`, true, exists ? `${size} bytes` : 'NOT FOUND');
    }

    // Check referenced link rel="stylesheet" tags
    const cssHrefMatches = Array.from(html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/g));
    for (const match of cssHrefMatches) {
      let cssRef = match[1];
      if (cssRef.startsWith('/')) cssRef = cssRef.slice(1);
      const cssFullPath = path.join(DIST_DIR, cssRef);
      const exists = fs.existsSync(cssFullPath);
      const size = exists ? fs.statSync(cssFullPath).size : 0;
      assert(exists && size > 0, `sidepanel.html stylesheet "${cssRef}" exists and non-empty`, true, exists ? `${size} bytes` : 'NOT FOUND');
    }
  }

  // 12. Deep verification of background service worker loader
  const swLoaderPath = path.join(DIST_DIR, 'service-worker-loader.js');
  if (fs.existsSync(swLoaderPath)) {
    const swContent = fs.readFileSync(swLoaderPath, 'utf8');
    assert(swContent.length > 0, 'service-worker-loader.js is non-empty', true, `${swContent.length} bytes`);
    
    // Check if it imports the real background module
    const importMatch = swContent.match(/import\s*["']([^"']+)["']/);
    if (importMatch) {
      let importedModule = importMatch[1];
      if (importedModule.startsWith('./')) importedModule = importedModule.slice(2);
      const moduleFullPath = path.join(DIST_DIR, importedModule);
      const exists = fs.existsSync(moduleFullPath);
      const size = exists ? fs.statSync(moduleFullPath).size : 0;
      assert(exists && size > 0, `service-worker-loader.js imported module "${importedModule}" exists and non-empty`, true, exists ? `${size} bytes` : 'NOT FOUND');
    }
  }

  // 13. Adversarial Check: Absence of Deprecated MV2 keys
  const deprecatedKeys = ['browser_action', 'page_action', 'background.scripts', 'permissions.tabs'];
  assert(manifest.browser_action === undefined, 'manifest contains no browser_action (MV2)', undefined, manifest.browser_action);
  assert(manifest.page_action === undefined, 'manifest contains no page_action (MV2)', undefined, manifest.page_action);
  assert(manifest.background?.scripts === undefined, 'manifest background contains no scripts array (MV2)', undefined, manifest.background?.scripts);

  // 14. Adversarial Check: PNG Header Magic bytes for icons
  const iconFiles = ['icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png'];
  for (const ic of iconFiles) {
    const full = path.join(DIST_DIR, ic);
    if (fs.existsSync(full)) {
      const buf = fs.readFileSync(full);
      // PNG magic number: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      assert(isPng, `Icon ${ic} has valid PNG binary magic header`, true, isPng);
    }
  }

  // 15. Adversarial Check: Sensitive env/secret leakage in dist
  const distFiles = fs.readdirSync(DIST_DIR);
  assert(!distFiles.includes('.env'), 'dist does not leak .env file', true, !distFiles.includes('.env'));
  assert(!distFiles.includes('.git'), 'dist does not leak .git directory', true, !distFiles.includes('.git'));

  console.log(`\nResults: ${passCount} Passed, ${failures.length} Failed`);
  return {
    passed: failures.length === 0,
    passCount,
    failureCount: failures.length,
    failures,
  };
}

const res = runEmpiricalAudit();
if (!res.passed) {
  process.exit(1);
}
