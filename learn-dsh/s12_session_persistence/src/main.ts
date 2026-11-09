import { JsonlSessionStore } from './jsonl-store.ts';
import { PersistenceBridge } from './persistence-bridge.ts';
import { interruptedTurnClosers } from './resume.ts';
import { SessionLog } from './session-log.ts';
import { CURRENT_FORMAT_VERSION } from './types.ts';
import type { SessionHeader } from './types.ts';

const sessionId = 'lesson-session-12';

function appendCompletedTurn(session: SessionLog, turn: number, prompt: string, answer: string): void {
  session.append({ type: 'turn/start', data: { turn } });
  session.append({ type: 'step/start', data: { turn, step: 1 } });
  session.append({
    type: 'user/message',
    data: { role: 'user', id: `user-${turn}`, content: [{ type: 'text', text: prompt }], source: { kind: 'user' } },
    surfaceOp: 'append',
  });
  session.append({
    type: 'assistant/message',
    data: {
      turn,
      step: 1,
      message: {
        role: 'assistant', id: `assistant-${turn}`, content: [{ type: 'text', text: answer }],
        source: { kind: 'model', provider: 'fake', model: 'fake-chat' },
      },
      stream: [{ type: 'text-chunks', time0: 1_700_000_000_000 + session.nextSeq, index: 0, dt: [], texts: [answer] }],
    },
    surfaceOp: 'append',
  });
  session.append({ type: 'step/end', data: { turn, step: 1 } });
  session.append({ type: 'turn/end', data: { turn, reason: { kind: 'completed' } } });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

const root = await Deno.makeTempDir({ dir: '.', prefix: '.learn-dsh-s12-' });
const header: SessionHeader = {
  type: 'session',
  version: CURRENT_FORMAT_VERSION,
  id: sessionId,
  createdAt: 1_700_000_000_000,
  isSeeded: false,
  delegationDepth: 0,
};

try {
  const firstStore = new JsonlSessionStore(root);
  const firstHandle = await firstStore.create(header);
  const firstSession = new SessionLog();
  const firstBridge = new PersistenceBridge(firstSession, firstHandle);

  appendCompletedTurn(firstSession, 1, 'Session 为什么需要事件日志？', '日志保存事实，消息历史可从中派生。');
  console.log(`进程 1：内存事件=${firstSession.nextSeq}，待写缓冲=${firstBridge.bufferedCount}`);
  console.log(`第一次 flush 前文件存在：${await fileExists(firstStore.pathFor(sessionId))}`);
  await firstBridge.flush();
  console.log(`第一次 flush 后：${(await firstHandle.read()).length} 条事件已写入并同步`);

  // The request prefix is durable before the model is called. Simulate a crash
  // after this flush, while the second turn and step are still open.
  firstSession.append({ type: 'turn/start', data: { turn: 2 } });
  firstSession.append({ type: 'step/start', data: { turn: 2, step: 1 } });
  firstSession.append({
    type: 'user/message',
    data: { role: 'user', id: 'user-2', content: [{ type: 'text', text: '继续刚才的实现。' }], source: { kind: 'user' } },
    surfaceOp: 'append',
  });
  await firstBridge.flush();
  console.log(`崩溃前最后一条已提交事件：seq=${firstSession.nextSeq - 1} user/message`);

  // The incomplete final JSONL row is a physical torn tail, not a committed event.
  await Deno.writeTextFile(firstStore.pathFor(sessionId), '{"type":"assistant/message","seq":9', { append: true });
  console.log('\n--- 模拟进程重启 ---');

  const resumedStore = new JsonlSessionStore(root);
  const resumedHandle = await resumedStore.open(sessionId, 'write');
  const persisted = await resumedHandle.read();
  console.log(`重开读取：${persisted.length} 条完整事件；丢弃并截断 ${resumedHandle.recoveredTailBytes} 字节撕裂尾部`);

  const closers = interruptedTurnClosers(persisted);
  await resumedHandle.append(closers);
  await resumedHandle.flush();
  console.log(`恢复方补记：${closers.map((event) => `${event.type}@${event.seq}`).join(', ')}`);

  const resumedSession = new SessionLog([...persisted, ...closers]);
  const resumedBridge = new PersistenceBridge(resumedSession, resumedHandle);
  appendCompletedTurn(resumedSession, 3, '先实现哪一部分？', '先实现持久化与恢复路径。');
  await resumedBridge.flush();
  await resumedBridge.close();

  const verifierStore = new JsonlSessionStore(root);
  const verifier = await verifierStore.open(sessionId, 'read');
  const finalEvents = await verifier.read();
  const tail = finalEvents.slice(-8).map((event) => `${event.seq}:${event.type}`).join(' → ');
  const firstLine = (await Deno.readTextFile(verifier.path)).split('\n')[0];
  console.log(`\n最终重开验证：${finalEvents.length} 条事件，nextSeq=${finalEvents.length}`);
  console.log(`末尾事件：${tail}`);
  console.log(`文件首行：${JSON.stringify(JSON.parse(firstLine))}`);
  await verifier.close();
} finally {
  await Deno.remove(root, { recursive: true });
}
