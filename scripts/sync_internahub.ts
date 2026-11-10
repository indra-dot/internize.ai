/**
 * sync_internahub.ts
 *
 * Automated sync script that fetches the latest InternaHub definition
 * directly from https://sites.google.com/view/drguswib/internahub
 * and compiles a structured TypeScript catalog & runtime dataset.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const GOOGLE_SITE_URL = 'https://sites.google.com/view/drguswib/internahub';
const OUTPUT_JSON_PATH = path.resolve('src/services/clinical/cdss/internahubCatalog.json');

async function syncInternaHub() {
  console.log(`[Sync] Fetching Google Site: ${GOOGLE_SITE_URL}...`);
  const siteRes = await fetch(GOOGLE_SITE_URL);
  if (!siteRes.ok) {
    throw new Error(`Failed to fetch Google Site: HTTP ${siteRes.status}`);
  }
  const siteHtml = await siteRes.text();

  // Find the embedded Google Apps Script / userCodeAppPanel / script.google.com link
  const iframeMatch = siteHtml.match(/src="(https:\/\/script\.google\.com\/macros\/s\/[^"]+)"/i) ||
                      siteHtml.match(/src="(https:\/\/1211146282-atari-embeds\.googleusercontent\.com\/[^"]+)"/i);

  let gasUrl = iframeMatch ? iframeMatch[1] : null;

  if (!gasUrl) {
    const rawGasMatch = siteHtml.match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/);
    if (rawGasMatch) {
      gasUrl = rawGasMatch[0];
    }
  }

  if (!gasUrl) {
    throw new Error('Could not find Google Apps Script iframe URL in Google Site HTML');
  }

  console.log(`[Sync] Found Google Apps Script endpoint: ${gasUrl}`);
  const gasRes = await fetch(gasUrl);
  if (!gasRes.ok) {
    throw new Error(`Failed to fetch Apps Script HTML: HTTP ${gasRes.status}`);
  }
  const gasRaw = await gasRes.text();

  // Extract userHtml from goog.script.init
  const initIdx = gasRaw.indexOf('goog.script.init(');
  if (initIdx === -1) {
    throw new Error('goog.script.init not found in Apps Script response');
  }

  const startQuote = initIdx + 'goog.script.init('.length;
  let i = startQuote + 1;
  while (i < gasRaw.length) {
    if (gasRaw[i] === '\\') {
      i += 2;
    } else if (gasRaw[i] === '"') {
      break;
    } else {
      i++;
    }
  }

  const jsStrLiteral = gasRaw.slice(startQuote, i + 1);
  const outerJsonStr = (new Function(`return ${jsStrLiteral}`))();
  const outerObj = JSON.parse(outerJsonStr);
  const html: string = outerObj.userHtml;

  console.log(`[Sync] Successfully extracted userHtml (${html.length} chars).`);

  // Extract all reg({ id, nama, divisi, ... }) entries
  const regRegex = /reg\((\{[\s\S]*?\n\s*\})\);/g;
  let match: RegExpExecArray | null;
  const calculators: any[] = [];

  while ((match = regRegex.exec(html)) !== null) {
    const block = match[1];
    const idM = block.match(/id:\s*['"]([^'"]+)['"]/);
    const namaM = block.match(/nama:\s*['"]([^'"]+)['"]/);
    const divisiM = block.match(/divisi:\s*['"]([^'"]+)['"]/);
    const tagsM = block.match(/tags:\s*['"]([^'"]+)['"]/);

    if (idM && namaM && divisiM) {
      // Check if it has fields
      const hasFields = /fields:\s*\[/.test(block);
      const hasMount = /mount:\s*function/.test(block);

      calculators.push({
        id: idM[1],
        nama: namaM[1],
        divisi: divisiM[1],
        tags: tagsM ? tagsM[1] : '',
        hasFields,
        hasMount
      });
    }
  }

  console.log(`[Sync] Extracted ${calculators.length} calculators from InternaHub.`);

  const catalog = {
    syncedAt: new Date().toISOString(),
    sourceUrl: GOOGLE_SITE_URL,
    totalCalculators: calculators.length,
    calculators
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`[Sync] Written catalog to ${OUTPUT_JSON_PATH}`);
}

syncInternaHub().catch((err) => {
  console.error('[Sync Error]', err);
  process.exit(1);
});
