import { FakeLlm } from './fake-llm.ts';
import { PreStepChain } from './pre-step.ts';
import { SessionLog } from './session-log.ts';
import type { PreStepDecision, UserMessage } from './types.ts';

type Trace = (line: string) => void;

export class TurnRunner {
  constructor(
    private readonly session: SessionLog,
    private readonly preStep: PreStepChain,
    private readonly llm: FakeLlm,
    private readonly trace: Trace,
  ) {}

  async runTurn(candidate: UserMessage): Promise<void> {
    const turn = 1;
    const step = 1;
    let reason: { kind: 'completed' | 'blocked' | 'error'; message?: string } = { kind: 'completed' };
    this.session.append({ type: 'turn/start', data: { turn } });
    this.trace(`[Inbox] claimed ${candidate.id}; agent/pre-step turn=${turn} step=${step}`);

    try {
      const frozenCandidate = Object.freeze({ ...candidate });
      const decision = await this.preStep.run({
        messages: Object.freeze([frozenCandidate]),
        turn,
        step,
      });
      this.trace(`[TurnRunner] decision=${this.describe(decision)}`);

      if (decision.kind === 'reject') {
        reason = { kind: 'blocked' };
        this.trace('[TurnRunner] rejected: no step, no model request, no user/message');
        return;
      }
      if (decision.messages.length === 0) {
        this.trace('[TurnRunner] entered an empty batch: completed without a step or model request');
        return;
      }

      this.session.append({ type: 'step/start', data: { turn, step } });
      try {
        for (const message of decision.messages) {
          this.session.append({ type: 'user/message', data: { turn, step, message } });
        }
        const answer = await this.llm.request(turn, step, this.session.modelMessages());
        this.session.append({ type: 'assistant/message', data: { turn, step, text: answer } });
      } finally {
        this.session.append({ type: 'step/end', data: { turn, step } });
      }
    } catch (error: unknown) {
      reason = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
      throw error;
    } finally {
      this.session.append({ type: 'turn/end', data: { turn, reason } });
    }
  }

  private describe(decision: PreStepDecision): string {
    if (decision.kind === 'reject') return 'reject';
    const text = decision.messages.map(({ text: value }) => value).join(' | ') || '(empty)';
    return `enter [${text}]`;
  }
}
