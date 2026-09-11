// Sync source of truth plugins/*/frontend/src → mfe-gateway/src/_plugins/*
// Chạy ở prebuild/predev (host) và trong Dockerfile (container).
// Lý do phải copy thay vì import trực tiếp ../../../:
//  1. Node resolution: react chỉ tồn tại ở mfe-gateway/node_modules,
//     file ngoài root không resolve được react.
//  2. Docker context: compose build chỉ gửi mfe-gateway/, file sibling
//     không tồn tại trong container nếu import trực tiếp.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gatewayDir = resolve(here, '..');
const pluginsDir = resolve(gatewayDir, '..');
const outDir = resolve(gatewayDir, 'src', '_plugins');

// Chỉ sync các plugin đã có frontend/src thật.
const codes = ['asset-module', 'crm-module'];
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const code of codes) {
  const src = resolve(pluginsDir, code, 'frontend', 'src');
  const dest = resolve(outDir, code);
  if (!existsSync(src)) {
    console.warn(`[sync-plugins] skip ${code}: missing ${src}`);
    continue;
  }
  cpSync(src, dest, { recursive: true });
  console.log(`[sync-plugins] ${code} → src/_plugins/${code}`);
}
console.log('[sync-plugins] done.');
