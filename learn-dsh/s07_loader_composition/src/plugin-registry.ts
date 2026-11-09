import type { PluginDefinition, PluginRegistry } from './types.ts';

const definitions = new Map<string, PluginDefinition>([
  ['logger', {
    start() {
      console.log('[logger] started');
      return () => console.log('[logger] stopped');
    },
  }],
  ['greeting', {
    start(config) {
      const message = config.message;
      if (typeof message !== 'string') {
        throw new Error('greeting plugin requires a string message');
      }
      console.log(`[greeting] ${message}`);
      return () => console.log('[greeting] stopped');
    },
  }],
  ['metrics', {
    start() {
      console.log('[metrics] started');
      return () => console.log('[metrics] stopped');
    },
  }],
]);

export const pluginRegistry: PluginRegistry = definitions;
