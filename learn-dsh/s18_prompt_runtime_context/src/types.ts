export interface AssemblyContext {
  readonly model: string;
  readonly workingDirectory: string;
  readonly branch: string;
}

export interface PromptSection {
  readonly name: string;
  readonly order: number;
  readonly text: string | ((context: AssemblyContext) => string);
  readonly interpolate?: boolean;
}

export interface PromptContext {
  readonly name: string;
  readonly order: number;
  readonly text: string | ((context: AssemblyContext) => string);
  readonly interpolate?: boolean;
}

export interface AssembledSection {
  readonly name: string;
  readonly order: number;
  readonly text: string;
  readonly interpolate?: boolean;
}

export interface AssembledContext {
  readonly name: string;
  readonly order: number;
  readonly text: string;
  readonly interpolate?: boolean;
}

export interface PromptAssembly {
  readonly sections: readonly AssembledSection[];
  readonly contexts: readonly AssembledContext[];
  readonly variables: Readonly<Record<string, string | undefined>>;
}

export type AssembleNext = () => Promise<PromptAssembly>;
export type AssembleListener = (assembly: PromptAssembly, next: AssembleNext) => Promise<PromptAssembly>;

export interface RequestMessage {
  readonly role: 'system' | 'user';
  readonly source: 'system-prompt' | 'runtime-context' | 'user';
  readonly content: string;
  readonly contextSections?: readonly string[];
}
