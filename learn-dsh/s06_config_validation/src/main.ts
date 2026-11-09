import { Context } from './context.ts';
import { greetingPlugin } from './greeting-plugin.ts';
import { Loader } from './loader.ts';

const loader = new Loader(new Context());
await loader.load(greetingPlugin, { targets: ['alpha', 'beta'] });

console.log('--- invalid config ---');
try {
  await loader.load(greetingPlugin, { targets: 'not-an-array' });
} catch (error) {
  if (!(error instanceof Error)) throw error;
  console.log(`[main] ${error.message}`);
}
