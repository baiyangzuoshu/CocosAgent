import { createContext } from './context.ts';
import { mount } from './loader.ts';
import { helloPlugin } from './plugins/hello.ts';

const ctx = createContext();
await mount(ctx, helloPlugin);
