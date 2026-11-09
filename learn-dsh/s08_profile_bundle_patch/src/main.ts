import { composeLayers } from './compose.ts';
import { layers } from './layers.ts';

const entries = composeLayers(layers);

console.log('--- effective plugin tree ---');
for (const entry of entries) {
  console.log(
    `${entry.id} | ${entry.name} | disabled=${entry.disabled === true} | config=${JSON.stringify(entry.config ?? {})}`,
  );
}
