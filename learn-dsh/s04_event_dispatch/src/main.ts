import { EventBus, type DispatchMode, type Listener } from './event-bus.ts';

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createListener(name: string, delay: number, result?: string): Listener {
  return async (mode: DispatchMode) => {
    console.log(`[${mode}] ${name} start`);
    await wait(delay);
    console.log(`[${mode}] ${name} done`);
    return result;
  };
}

const events = new EventBus();
events.on(createListener('A', 20));
events.on(createListener('B', 5, 'handled'));
events.on(createListener('C', 10));

console.log('--- emit ---');
events.emit('emit');
console.log('[main] emit returned without waiting');
await wait(30);

console.log('--- parallel ---');
await events.parallel('parallel');
console.log('[main] parallel returned after all listeners');

console.log('--- serial ---');
const result = await events.serial('serial');
console.log(`[main] serial result: ${result}`);
