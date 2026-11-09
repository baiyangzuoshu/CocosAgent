import { EventLog } from './events.ts';
import { measureSurface, selectCompactableRange } from './context-budget.ts';
import { searchEvents } from './query.ts';
import { deriveEventMessage, foldSurface } from './surface.ts';

const SYSTEM_TEXT = '你是项目知识库助手，请保留用户确认过的设计约束。';
const CHECKPOINT_PREAMBLE =
  'This is an automatically generated checkpoint condensing an earlier span of the conversation to free up context. Treat the captured context as established background and build on it without restating it. Continue the task directly from the messages that follow, without acknowledging this checkpoint.';
const MAX_CONTEXT_UNITS = 560;
const RETAIN_RECENT_UNITS = 90;

const log = new EventLog();

function addTurn(turn: number, prompt: string, answer: string): void {
  log.append({ type: 'turn/start', data: { turn } });
  log.append({ type: 'step/start', data: { turn, step: 1 } });
  log.append({
    type: 'user/message',
    data: {
      role: 'user', id: `user-${turn}`, content: [{ type: 'text', text: prompt }], source: { kind: 'user' },
    },
    surfaceOp: 'append',
  });
  log.append({
    type: 'assistant/message',
    data: {
      turn,
      step: 1,
      message: {
        role: 'assistant', id: `assistant-${turn}`, content: [{ type: 'text', text: answer }],
        source: { kind: 'model', provider: 'fake', model: 'fake-chat' },
      },
      stream: [{ type: 'text-chunks', time0: 1_700_000_000_000 + log.snapshot().length, index: 0, dt: [], texts: [answer] }],
    },
    surfaceOp: 'append',
  });
  log.append({ type: 'step/end', data: { turn, step: 1 } });
  log.append({ type: 'turn/end', data: { turn, reason: { kind: 'completed' } } });
}

function printMeasurement(label: string): void {
  const measurement = measureSurface(log.snapshot());
  const costs = measurement.nodes.map(({ seq, units }) => `${seq}:${units}`).join(' ');
  console.log(`${label}: ${measurement.totalUnits}/${MAX_CONTEXT_UNITS} 字符预算; nodes ${costs}`);
}

log.append({
  type: 'system/message',
  data: {
    turn: 1,
    step: 1,
    message: { role: 'system', id: 'system-1', content: [{ type: 'text', text: SYSTEM_TEXT }], source: { kind: 'system' } },
  },
  surfaceOp: 'append',
});

addTurn(
  1,
  '我们要设计一个离线优先的项目知识库，网络断开时仍然可以继续创建、修改和删除条目。所有本地操作先记为 append-only JSONL 事件，每项包含稳定的事件 ID、会话 ID、连续序号、时间戳、操作类型和内容。上传失败不能撤回本地修改，也不能让已经确认的记录丢失；联网后应按顺序重试尚未确认的事件。',
  '建议把不可变事件日志作为本地事实来源，UI 和搜索索引都由日志投影生成。启动时恢复所有完整、连续的事件，只有不完整的最终物理行可以丢弃。已提交行不可原地编辑；用户更正要追加新事件并保留原始记录。上传端使用稳定事件 ID 去重，确认成功后才从待同步队列中移除该事件。',
);
addTurn(
  2,
  '两台设备都可能离线修改同一条笔记。操作需要保留各自设备的来源 ID，恢复连接后按会话和序号稳定排序，再执行明确的字段级合并策略；无法自动合并时不要静默选择一方。冲突事件要能通过关键字查询，并能够追踪它们从哪个原始事件派生。',
  '收到。我们会采用 append-only JSONL、离线待同步队列和确定性冲突排序。冲突规则先保留双方修改，再记录合并结果，不直接静默覆盖；每次同步完成后才清理已确认的队列项。',
);
addTurn(
  3,
  '查询如何同时找到冲突记录，并区分仍在上下文中的消息与已被摘要替换的消息？',
  '查询可以检索完整日志并标注 current、shadowed 或 log-only；模型请求只使用 current surface。',
);

console.log('--- compaction 前 ---');
printMeasurement('当前历史');

const before = measureSurface(log.snapshot());
const range = selectCompactableRange(log.snapshot(), before, RETAIN_RECENT_UNITS);
if (before.totalUnits <= MAX_CONTEXT_UNITS || range === null) {
  throw new Error('example expected an over-budget history and a compactable prefix');
}

const start = log.append({ type: 'compaction/start', data: { compactionId: 'compact-13', turn: null } });
const summaryText =
  '本地事实源采用 append-only JSONL；离线修改留在待同步队列，上传使用稳定事件 ID 去重。冲突不覆盖原记录，而是保留双方修改并追加显式合并结果。';
const checkpointContent = [
  { type: 'text' as const, text: `${CHECKPOINT_PREAMBLE}\n\n<compacted-summary>` },
  { type: 'text' as const, text: summaryText },
  { type: 'text' as const, text: '</compacted-summary>' },
];
const shadowedUnits = before.nodes
  .filter((node) => range.shadowedSeqs.includes(node.seq))
  .reduce((sum, node) => sum + node.units, 0);
const checkpointUnits = checkpointContent.map((block) => block.text).join('\n').length;
if (checkpointUnits >= shadowedUnits) {
  throw new Error(`summary checkpoint (${checkpointUnits}) is not smaller than selected history (${shadowedUnits})`);
}
const summary = log.append({
  type: 'compaction/summary',
  data: {
    compactionId: 'compact-13',
    summary: [{ type: 'text', text: summaryText }],
    shadowedRange: { start: range.startSeq, end: range.endSeq },
    shadowedSeqs: range.shadowedSeqs,
    shadowedTokenCount: shadowedUnits,
    provider: 'fake',
    model: 'fake-chat',
  },
});
log.append({
  type: 'user/message',
  data: {
    role: 'user', id: 'checkpoint-13',
    content: checkpointContent,
    source: { kind: 'compact-checkpoint', compactionId: 'compact-13' },
  },
  surfaceOp: { op: 'replace', startSeq: range.startSeq, endSeq: range.endSeq },
  sourceEventSeqs: [start.seq, summary.seq, ...range.shadowedSeqs],
});
log.append({ type: 'compaction/end', data: { compactionId: 'compact-13', turn: null } });

console.log(`压缩区间：surface seq ${range.startSeq}…${range.endSeq}，原节点 [${range.shadowedSeqs.join(', ')}]`);
console.log(`保留近期预算：${RETAIN_RECENT_UNITS} 字符单位；系统提示词 surface node 0 不参与替换`);
console.log(`压缩前缀：${shadowedUnits} 字符单位 → checkpoint ${checkpointUnits} 字符单位`);
console.log('--- compaction 后 ---');
printMeasurement('当前历史');
console.log(`当前 surface seqs: [${foldSurface(log.snapshot()).nodes.join(', ')}]`);

const query = 'append-only JSONL';
console.log(`--- 全日志查询：${JSON.stringify(query)} ---`);
for (const result of searchEvents(log.snapshot(), query)) {
  console.log(`seq=${result.seq} ${result.type} [${result.surface}] ${result.text.slice(0, 90)}`);
}
console.log('--- 当前上下文中的匹配 ---');
for (const result of searchEvents(log.snapshot(), query, 'current')) {
  console.log(`seq=${result.seq} [${result.surface}] ${result.text.slice(0, 90)}`);
}
const allEvents = log.snapshot();
const currentNodes = foldSurface(allEvents).nodes;
const bySeq = new Map(allEvents.map((event) => [event.seq, event]));
const currentMessageCount = currentNodes.filter((seq) => {
  const event = bySeq.get(seq);
  return event !== undefined && deriveEventMessage(event) !== null;
}).length;
console.log(`raw log events: ${allEvents.length}; current model messages: ${currentMessageCount}`);
