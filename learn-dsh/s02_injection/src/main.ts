import { Context } from './context.ts';
import { Loader } from './loader.ts';
import { greetingConsumer } from './plugins/greeting-consumer.ts';
import { greeterProvider } from './plugins/greeter-provider.ts';

const ctx = new Context();
const loader = new Loader(ctx);
await loader.load([greetingConsumer, greeterProvider]);
