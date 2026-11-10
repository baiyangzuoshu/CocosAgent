export interface LegacyNamespace extends Record<string, unknown> {
  _global: typeof globalThis;
  internal: Record<string, unknown>;
}

const host = globalThis as typeof globalThis & {
  cc?: LegacyNamespace;
  CocosEngine?: string;
};

export const cclegacy: LegacyNamespace = host.cc ?? {
  _global: globalThis,
  internal: {},
};

cclegacy.internal ??= {};
host.CocosEngine = "3.8.7";
host.cc = cclegacy;

export const legacyCC = cclegacy;
