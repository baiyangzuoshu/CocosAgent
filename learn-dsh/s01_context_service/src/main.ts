import { Context } from './context.ts';
import { mount } from './loader.ts';
import { greetingConsumer } from './plugins/greeting-consumer.ts';
import { greeterProvider } from './plugins/greeter-provider.ts';

const ctx = new Context();
await mount(ctx, greeterProvider);
await mount(ctx, greetingConsumer);
