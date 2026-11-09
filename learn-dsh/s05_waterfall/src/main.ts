import { Waterfall } from './waterfall.ts';

const waterfall = new Waterfall();

waterfall.on(async (input, next) => {
  console.log(`[transform] enter: ${input}`);
  const result = await next();
  console.log('[transform] wrap result');
  return result.toUpperCase();
});

waterfall.on((input, next) => {
  if (input.includes('blocked')) {
    console.log('[policy] block');
    return '** blocked **';
  }
  console.log('[policy] pass');
  return next();
});

console.log('--- pass-through ---');
console.log(await waterfall.run('hello', () => {
  console.log('[fallback] handle: hello');
  return 'hello';
}));

console.log('--- blocked ---');
console.log(await waterfall.run('blocked words', () => {
  console.log('[fallback] handle: blocked words');
  return 'blocked words';
}));
