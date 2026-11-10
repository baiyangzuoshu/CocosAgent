import type { RuntimeConstants } from "../../build/runtime-constants.ts";

export function canResume(initialized: boolean, constants: RuntimeConstants): boolean {
  // Mirrors Game.run: do not resume before init or in EDITOR_NOT_IN_PREVIEW.
  return initialized && !constants.EDITOR_NOT_IN_PREVIEW;
}
