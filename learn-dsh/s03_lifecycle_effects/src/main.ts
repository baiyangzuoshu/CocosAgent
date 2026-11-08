import { MessageFeed } from './feed.ts';
import { Loader } from './loader.ts';
import { messageListener } from './plugins/message-listener.ts';

const messages = new MessageFeed();
const loader = new Loader(messages);
const fiber = await loader.mount(messageListener);

console.log('[main] publish before unload');
messages.publish('before unload');
console.log('[main] unload plugin');
await fiber.dispose();
console.log('[main] publish after unload');
messages.publish('after unload');
