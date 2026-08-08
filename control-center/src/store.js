import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(process.cwd());
export const DATA = path.join(ROOT, 'data');
export const CONFIG = path.join(ROOT, 'config.json');

export async function ensureData() {
  await mkdir(DATA, { recursive: true });
}

export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

export async function writeJson(file, value) {
  await ensureData();
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  await rename(temp, file);
}

export async function loadConfig() {
  if (!existsSync(CONFIG)) {
    const example = await readJson(path.join(ROOT, 'config.example.json'), {});
    await writeJson(CONFIG, example);
  }
  return readJson(CONFIG, {});
}

export async function audit(type, detail, actor = 'Painel local') {
  const file = path.join(DATA, 'audit.json');
  const items = await readJson(file, []);
  items.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), type, actor, detail });
  await writeJson(file, items.slice(0, 1000));
  return items[0];
}
