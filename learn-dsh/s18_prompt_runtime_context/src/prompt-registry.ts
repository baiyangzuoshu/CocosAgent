import type {
  AssembledContext,
  AssembledSection,
  AssembleListener,
  AssemblyContext,
  PromptAssembly,
  PromptContext,
  PromptSection,
} from './types.ts';

type VariableProvider = (context: AssemblyContext) => string | undefined;

/** Teaching-sized analogue of ctx.systemPrompt and its assemble waterfall. */
export class PromptRegistry {
  #sections = new Map<string, PromptSection>();
  #contexts = new Map<string, PromptContext>();
  #variables = new Map<string, VariableProvider>();
  #listeners: AssembleListener[] = [];

  section(section: PromptSection): void {
    this.insert(this.#sections, section.name, section, 'section');
  }

  context(context: PromptContext): void {
    this.insert(this.#contexts, context.name, context, 'context');
  }

  variable(name: string, provider: VariableProvider): void {
    this.insert(this.#variables, name, provider, 'variable');
  }

  onAssemble(listener: AssembleListener): void {
    this.#listeners.push(listener);
  }

  async assemble(context: AssemblyContext): Promise<PromptAssembly> {
    const variables: Record<string, string | undefined> = {};
    for (const [name, provider] of this.#variables) variables[name] = provider(context);

    const sections: AssembledSection[] = [...this.#sections.values()]
      .sort((a, b) => a.order - b.order || compareNames(a.name, b.name))
      .map(({ name, order, text, interpolate }) => ({
        name,
        order,
        text: typeof text === 'function' ? text(context) : text,
        ...(interpolate === undefined ? {} : { interpolate }),
      }));
    const contexts: AssembledContext[] = [...this.#contexts.values()]
      .sort((a, b) => a.order - b.order || compareNames(a.name, b.name))
      .map(({ name, order, text, interpolate }) => ({
        name,
        order,
        text: typeof text === 'function' ? text(context) : text,
        ...(interpolate === undefined ? {} : { interpolate }),
      }));

    const base: PromptAssembly = { sections, contexts, variables };
    const dispatch = async (index: number): Promise<PromptAssembly> => {
      const listener = this.#listeners[index];
      if (listener === undefined) return base;
      return listener(base, () => dispatch(index + 1));
    };
    return dispatch(0);
  }

  private insert<T>(map: Map<string, T>, name: string, value: T, kind: string): void {
    if (map.has(name)) throw new Error(`duplicate ${kind}: ${name}`);
    map.set(name, value);
  }
}

function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
