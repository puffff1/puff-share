#!/usr/bin/env node
/**
 * 扫描 资源/ 目录，生成 _index.json（供 Puff 资源集市 CDN 拉取）。
 * 在资源仓库的 GitHub Actions 里运行。
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const RESOURCE_ROOT = '资源';
const SCHEMA = 'puff_share_index';
const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;
const ASSET_RE = /\.asset\.[^.]+$/i;
const DESC_RE = /^(说明\.txt|readme\.(md|txt))$/i;
const HIDDEN = new Set(['.github', '.git', 'node_modules', 'netlify', 'scripts']);

function gitTime(path) {
  try {
    return execSync(`git log -1 --format=%cI -- "${path}"`, { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

function isPreviewImage(name) {
  return IMAGE_RE.test(name) && !ASSET_RE.test(name);
}

function walkResourceTree() {
  const rootPath = join(ROOT, RESOURCE_ROOT);
  try {
    statSync(rootPath);
  } catch {
    return { folders: [], entries: [] };
  }

  const folderMap = new Map();

  function ensureFolder(name) {
    if (!folderMap.has(name)) folderMap.set(name, new Map());
    return folderMap.get(name);
  }

  function scanDir(absDir, relParts) {
    for (const name of readdirSync(absDir)) {
      if (name.startsWith('.')) continue;
      const abs = join(absDir, name);
      const rel = [...relParts, name].join('/');
      const st = statSync(abs);
      if (st.isDirectory()) {
        if (relParts.length === 0) {
          if (HIDDEN.has(name)) continue;
          scanDir(abs, [RESOURCE_ROOT, name]);
        } else if (relParts.length === 1) {
          const folder = relParts[1];
          const entryMap = ensureFolder(folder);
          const key = `dir:${rel}`;
          if (!entryMap.has(key)) {
            entryMap.set(key, {
              folder,
              name,
              type: 'dir',
              path: rel,
              files: [],
              images: [],
              description: '',
              updatedAt: gitTime(rel),
            });
          }
          scanDir(abs, relParts.concat(name));
        } else if (relParts.length === 2) {
          scanDir(abs, relParts.concat(name));
        }
        continue;
      }

      if (relParts.length < 2) continue;
      const folder = relParts[1];
      if (HIDDEN.has(folder)) continue;

      if (relParts.length === 2) {
        const entryMap = ensureFolder(folder);
        entryMap.set(`file:${rel}`, {
          folder,
          name: name.replace(/\.[^.]+$/, ''),
          type: 'file',
          path: rel,
          files: [rel],
          images: [],
          description: '',
          updatedAt: gitTime(rel),
        });
        continue;
      }

      const entryPath = relParts.slice(0, 3).join('/');
      const entryMap = ensureFolder(folder);
      const key = `dir:${entryPath}`;
      if (!entryMap.has(key)) {
        entryMap.set(key, {
          folder,
          name: relParts[2],
          type: 'dir',
          path: entryPath,
          files: [],
          images: [],
          description: '',
          updatedAt: gitTime(entryPath),
        });
      }
      const entry = entryMap.get(key);
      if (DESC_RE.test(name)) {
        try {
          entry.description = readFileSync(abs, 'utf8').trim().slice(0, 500);
        } catch {
          /* ignore */
        }
      } else if (name === '.author') {
        try {
          entry.author = readFileSync(abs, 'utf8').trim();
        } catch {
          /* ignore */
        }
      } else if (isPreviewImage(name)) {
        entry.images.push(rel);
      } else if (!name.startsWith('.')) {
        entry.files.push(rel);
      }
    }
  }

  scanDir(rootPath, [RESOURCE_ROOT]);

  const folders = [];
  const entries = [];
  for (const [name, entryMap] of folderMap) {
    folders.push({ name, count: entryMap.size });
    entries.push(...entryMap.values());
  }
  return { folders, entries };
}

const { folders, entries } = walkResourceTree();
const payload = {
  schema: SCHEMA,
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  folders,
  entries,
};

writeFileSync(join(ROOT, '_index.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote _index.json (${entries.length} entries, ${folders.length} folders)`);
