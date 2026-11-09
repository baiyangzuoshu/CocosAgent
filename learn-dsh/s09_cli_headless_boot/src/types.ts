export interface LauncherInvocation {
  profile: string;
  patchFiles: string[];
  appArgs: string[];
}

export interface HeadlessStartup {
  task: string;
  json: boolean;
}

export interface ProfileDefinition {
  bundles: readonly string[];
  entries: readonly string[];
}
