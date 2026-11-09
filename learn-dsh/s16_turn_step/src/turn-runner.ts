import { ScriptedFakeLlm } from './fake-llm.ts';
import { SessionLog } from './session-log.ts';
import type { ToolCall, UserMessage } from './types.ts';

/** Runs the smallest turn loop that demonstrates the durable Turn/Step boundaries. */
export class TurnRunner {
  constructor(
    private readonly session: SessionLog,
    private readonly llm: ScriptedFakeLlm,
  ) {}

  async runTurn(input: UserMessage): Promise<void> {
    const turn = 1;
    let step = 0;
    let reason: { kind: 'completed' | 'error'; message?: string } = { kind: 'completed' };
    this.session.append({ type: 'turn/start', data: { turn } });

    try {
      while (true) {
        step += 1;
        this.session.append({ type: 'step/start', data: { turn, step } });
        try {
          if (step === 1) {
            this.session.append({
              type: 'user/message',
              data: { turn, step, id: input.id, text: input.text },
            });
          }

          const response = await this.llm.request({
            turn,
            step,
            messages: this.session.modelHistory(),
          });
          const calls = response.toolCalls ?? [];
          this.session.append({
            type: 'assistant/message',
            data: { turn, step, text: response.text, toolCalls: calls },
          });

          if (calls.length === 0) break;
          for (const call of calls) await this.executeFakeTool(call, turn, step);
        } finally {
          this.session.append({ type: 'step/end', data: { turn, step } });
        }
      }
    } catch (error: unknown) {
      reason = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
      throw error;
    } finally {
      this.session.append({ type: 'turn/end', data: { turn, reason } });
    }
  }

  private async executeFakeTool(call: ToolCall, turn: number, step: number): Promise<void> {
    this.session.append({
      type: 'tool/call',
      data: { turn, step, callId: call.id, name: call.name, arguments: call.arguments },
    });
    const result = await this.lookupStock(call);
    this.session.append({
      type: 'tool/result',
      data: { turn, step, callId: call.id, name: call.name, text: result },
    });
  }

  private async lookupStock(call: ToolCall): Promise<string> {
    if (call.name !== 'lookup_stock') throw new Error(`unknown fake tool: ${call.name}`);
    const args: unknown = JSON.parse(call.arguments);
    if (typeof args !== 'object' || args === null || !('sku' in args) || typeof args.sku !== 'string') {
      throw new Error('lookup_stock expects a sku string');
    }
    await Promise.resolve();
    return `${args.sku}: 可用库存 12 件`;
  }
}
