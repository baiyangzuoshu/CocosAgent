import type { ProfileDefinition } from './types.ts';

export const profiles: Readonly<Record<string, ProfileDefinition>> = {
  headless: {
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-headless'],
    entries: ['headless-startup', 'headless-runner'],
  },
};
