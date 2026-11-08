import type { Context, Plugin } from '../types.ts';

function apply(ctx: Context): void {
  ctx.effect(() => {
    const unsubscribe = ctx.messages.subscribe((message) => {
      ctx.log('message-listener', `message: ${message}`);
    });
    ctx.log('message-listener', 'subscribed');
    return () => {
      unsubscribe();
      ctx.log('message-listener', 'unsubscribed');
    };
  });
}

export const messageListener: Plugin = {
  name: 'message-listener',
  apply,
};
