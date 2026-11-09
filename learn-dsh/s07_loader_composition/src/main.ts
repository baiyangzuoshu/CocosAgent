import { Loader } from './loader.ts';
import { pluginRegistry } from './plugin-registry.ts';

async function readConfig(name: string): Promise<unknown> {
  const url = new URL(`./configs/${name}.json`, import.meta.url);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

const loader = new Loader(pluginRegistry);

console.log('--- load initial config ---');
await loader.applyConfig(await readConfig('initial'));

console.log('--- apply edited config ---');
await loader.applyConfig(await readConfig('updated'));

console.log('--- apply config with greeting removed ---');
await loader.applyConfig(await readConfig('final'));
await loader.disposeAll();
