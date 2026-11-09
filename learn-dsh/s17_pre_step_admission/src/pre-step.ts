import type { PreStepDecision, PreStepListener, PreStepPayload } from './types.ts';

/** Around-middleware chain with an `enter(messages)` fallback at the center. */
export class PreStepChain {
  #listeners: PreStepListener[] = [];

  use(listener: PreStepListener): void {
    this.#listeners.push(listener);
  }

  run(payload: PreStepPayload): Promise<PreStepDecision> {
    const dispatch = async (index: number): Promise<PreStepDecision> => {
      const listener = this.#listeners[index];
      if (listener === undefined) {
        return { kind: 'enter', messages: [...payload.messages] };
      }
      return listener(payload, () => dispatch(index + 1));
    };
    return dispatch(0);
  }
}
