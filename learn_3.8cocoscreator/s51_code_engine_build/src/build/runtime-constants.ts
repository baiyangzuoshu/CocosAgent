export type RuntimeTarget = "editor" | "preview" | "build";

export interface RuntimeConstants {
  EDITOR: boolean;
  EDITOR_NOT_IN_PREVIEW: boolean;
  PREVIEW: boolean;
  BUILD: boolean;
}

export function createRuntimeConstants(target: RuntimeTarget): RuntimeConstants {
  return {
    EDITOR: target === "editor",
    EDITOR_NOT_IN_PREVIEW: target === "editor",
    PREVIEW: target === "preview",
    BUILD: target === "build",
  };
}
