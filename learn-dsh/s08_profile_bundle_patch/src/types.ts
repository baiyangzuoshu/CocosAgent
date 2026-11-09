export interface PluginEntry {
  id: string;
  name: string;
  disabled?: boolean;
  config?: Record<string, unknown>;
  inject?: string[];
  [key: string]: unknown;
}

export interface EntryPatch {
  id?: string;
  name?: string;
  insert?: PluginEntry[];
  [key: string]: unknown;
}

export interface PatchLayer {
  label: string;
  patches: EntryPatch[];
}
