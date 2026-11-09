import { PromptRegistry } from './prompt-registry.ts';
import { buildRequestMessages, renderPrompt, renderRuntimeContext } from './render.ts';
import type { AssemblyContext } from './types.ts';

const prompts = new PromptRegistry();
prompts.section({
  name: 'deployment:persona',
  order: 0,
  text: '你是一个谨慎的代码助手。',
});
prompts.section({
  name: 'task:response-rules',
  order: 20,
  text: '请使用 {{response_language}} 回答。当前路由模型为 {{model}}。',
});
prompts.variable('response_language', () => '简体中文');
prompts.variable('model', (context) => context.model);
prompts.context({
  name: 'workspace:directory',
  order: 100,
  interpolate: false,
  text: (context) => `当前工作目录：${context.workingDirectory}`,
});
prompts.context({
  name: 'git:branch',
  order: 110,
  interpolate: false,
  text: (context) => `当前 Git 分支：${context.branch}`,
});

prompts.onAssemble(async (assembly, next) => {
  const resolved = await next();
  console.log(`[system-prompt/assemble] sections=${resolved.sections.map(({ name }) => name).join(', ')}; contexts=${resolved.contexts.map(({ name }) => name).join(', ')}`);
  return {
    ...resolved,
    sections: [
      ...resolved.sections,
      { name: 'event:output-contract', order: 50, text: 'If a fact is missing, state what is unknown.' },
    ],
  };
});

const firstContext: AssemblyContext = {
  model: 'fake-chat-v1',
  workingDirectory: '/workspace/learn-dsh',
  branch: 'learn',
};
const secondContext: AssemblyContext = {
  ...firstContext,
  workingDirectory: '/workspace/learn-dsh/exercises',
  branch: 'lesson-18-exercise',
};

for (const [index, context] of [firstContext, secondContext].entries()) {
  console.log(`\n--- request ${index + 1} ---`);
  const assembly = await prompts.assemble(context);
  console.log(`rendered system prompt:\n${renderPrompt(assembly)}`);
  const runtime = renderRuntimeContext(assembly);
  console.log(`runtime context sections: ${JSON.stringify(runtime.sections)}`);
  const messages = buildRequestMessages(assembly, '请说明当前项目上下文。');
  console.log('model request messages:');
  for (const message of messages) {
    console.log(JSON.stringify(message));
  }
}
