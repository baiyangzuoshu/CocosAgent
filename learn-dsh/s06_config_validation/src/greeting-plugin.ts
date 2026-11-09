import type { Context, Plugin, Schema } from './types.ts';

export interface GreetingConfig {
  greeting: string;
  targets: string[];
}

export class ConfigValidationError extends Error {
  constructor(path: string, expected: string) {
    super(`invalid config: ${path} expected ${expected}`);
    this.name = 'ConfigValidationError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const GreetingConfigSchema: Schema<GreetingConfig> = {
  parse(input) {
    if (!isObject(input)) {
      throw new ConfigValidationError('$', 'object');
    }

    const greeting = input.greeting === undefined ? 'Hello' : input.greeting;
    if (typeof greeting !== 'string') {
      throw new ConfigValidationError('$.greeting', 'string');
    }

    const rawTargets = input.targets === undefined ? ['world'] : input.targets;
    if (!Array.isArray(rawTargets)) {
      throw new ConfigValidationError('$.targets', 'array of strings');
    }

    const targets: string[] = [];
    for (let index = 0; index < rawTargets.length; index += 1) {
      const target: unknown = rawTargets[index];
      if (typeof target !== 'string') {
        throw new ConfigValidationError(`$.targets[${index}]`, 'string');
      }
      targets.push(target);
    }

    return { greeting, targets };
  },
};

function apply(ctx: Context, config: GreetingConfig): void {
  for (const target of config.targets) {
    ctx.log('greeting', `${config.greeting}, ${target}!`);
  }
}

export const greetingPlugin: Plugin<GreetingConfig> = {
  name: 'greeting',
  Config: GreetingConfigSchema,
  apply,
};
