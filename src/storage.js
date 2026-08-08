import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const updateQueues = new Map();

function cloneFallback(fallback) {
  return fallback === undefined ? undefined : structuredClone(fallback);
}

export async function readJson(file, fallback = {}) {
  try {
    const content = await readFile(file, 'utf8');
    if (!content.trim()) return cloneFallback(fallback);
    return JSON.parse(content);
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    if (error instanceof SyntaxError) {
      console.warn(`JSON inválido preservado em ${path.basename(file)}; usando valores padrão nesta execução.`);
    }
    return cloneFallback(fallback);
  }
}

export async function writeJsonAtomic(file, value) {
  const absolute = path.resolve(file);
  await mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${process.pid}.${crypto.randomUUID()}.tmp`;

  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, absolute);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export function updateJson(file, fallback, update) {
  const key = path.resolve(file);
  const previous = updateQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    const value = await readJson(key, fallback);
    const result = await update(value);
    const next = result === undefined ? value : result;
    await writeJsonAtomic(key, next);
    return next;
  });

  updateQueues.set(key, current);
  current.finally(() => {
    if (updateQueues.get(key) === current) updateQueues.delete(key);
  }).catch(() => {});
  return current;
}
