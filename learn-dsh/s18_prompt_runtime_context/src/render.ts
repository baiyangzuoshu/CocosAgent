import type { PromptAssembly, RequestMessage } from './types.ts';

export function renderPrompt(assembly: PromptAssembly): string {
  return assembly.sections
    .map((section) => section.interpolate === false
      ? section.text
      : interpolate(section.text, assembly.variables, `section "${section.name}"`))
    .filter((text) => text.length > 0)
    .join('\n\n');
}

export function renderRuntimeContext(assembly: PromptAssembly): { text: string; sections: string[] } {
  const sections = assembly.contexts
    .map((context) => context.interpolate === false
      ? context.text
      : interpolate(context.text, assembly.variables, `context "${context.name}"`))
    .filter((text) => text.length > 0);
  return {
    sections,
    text: sections.length === 0
      ? ''
      : `Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\n${sections.join('\n\n')}`,
  };
}

export function buildRequestMessages(
  assembly: PromptAssembly,
  userText: string,
): RequestMessage[] {
  const messages: RequestMessage[] = [];
  const systemPrompt = renderPrompt(assembly);
  if (systemPrompt.length > 0) {
    messages.push({ role: 'system', source: 'system-prompt', content: systemPrompt });
  }
  messages.push({ role: 'user', source: 'user', content: userText });
  const runtimeContext = renderRuntimeContext(assembly);
  if (runtimeContext.text.length > 0) {
    messages.push({
      role: 'user',
      source: 'runtime-context',
      content: runtimeContext.text,
      contextSections: runtimeContext.sections,
    });
  }
  return messages;
}

function interpolate(text: string, variables: Readonly<Record<string, string | undefined>>, owner: string): string {
  return text.replace(/\{\{([^{}]*)\}\}/g, (_match, name: string) => {
    if (!/^[a-z][a-z0-9_]*$/.test(name) || !Object.hasOwn(variables, name)) {
      throw new Error(`unknown prompt variable "{{${name}}}" in ${owner}`);
    }
    const value = variables[name];
    if (value === undefined) throw new Error(`prompt variable "{{${name}}}" has no value in ${owner}`);
    return value;
  });
}
