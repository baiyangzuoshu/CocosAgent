import type { EntryPatch, PatchLayer, PluginEntry } from './types.ts';

function indexEntries(entries: readonly PluginEntry[]): Map<string, PluginEntry> {
  const byId = new Map<string, PluginEntry>();
  for (const entry of entries) {
    if (byId.has(entry.id)) throw new Error(`duplicate entry id: ${entry.id}`);
    byId.set(entry.id, entry);
  }
  return byId;
}

function applyPatch(
  entries: PluginEntry[],
  byId: Map<string, PluginEntry>,
  patch: EntryPatch,
): void {
  if (patch.insert) {
    if (patch.id) {
      console.warn(`[patch] group insert is outside this lesson: id=${patch.id}`);
      return;
    }
    for (const entry of structuredClone(patch.insert)) {
      if (byId.has(entry.id)) throw new Error(`duplicate entry id: ${entry.id}`);
      entries.push(entry);
      byId.set(entry.id, entry);
      console.log(`[patch] insert id=${entry.id}`);
    }
    return;
  }

  if (!patch.id) {
    console.warn('[patch] skip: id is required for an entry override');
    return;
  }

  const target = byId.get(patch.id);
  if (!target) {
    console.warn(`[patch] skip: id=${patch.id} was not found`);
    return;
  }
  if (patch.name && patch.name !== target.name) {
    console.warn(`[patch] skip: name does not match id=${patch.id}`);
    return;
  }

  const { id, name: _expectedName, insert: _insert, ...overrides } = patch;
  const fields = Object.keys(overrides);
  Object.assign(target, structuredClone(overrides));
  console.log(`[patch] update id=${id} fields=${fields.join(',')}`);
}

export function composeLayers(layers: readonly PatchLayer[]): PluginEntry[] {
  const entries: PluginEntry[] = [];
  const byId = indexEntries(entries);

  for (const layer of layers) {
    console.log(`--- ${layer.label} ---`);
    for (const patch of layer.patches) applyPatch(entries, byId, patch);
  }

  return entries;
}
