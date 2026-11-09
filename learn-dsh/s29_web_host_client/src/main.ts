import { BrowserSession, ConversationView } from "./browser-session.ts";
import { HostSession } from "./host-session.ts";
import { LocalRemoteMux, REMOTE_MUX_PATH } from "./remote-mux.ts";
import { SessionProjectionStore } from "./session-projection.ts";

const hostSession = new HostSession("session-29");
hostSession.append({
  type: "user/message",
  data: { text: "DeepSeek Harness 如何把生成结果显示在 Web 对话里？" },
});

const mux = new LocalRemoteMux();
const projection = new SessionProjectionStore();
const browser = new BrowserSession(projection);
await browser.connect((signal) => mux.openSessionFollow(hostSession, signal));
const view = new ConversationView(projection);

try {
  console.log(`浏览器已通过 ${REMOTE_MUX_PATH} 收到 Host 快照。`);
  await runHostTurn(hostSession);
  await browser.waitForCursor(hostSession.cursor);
  console.log("浏览器最终投影：", projection.getSnapshot());
} finally {
  await browser.dispose();
  view.dispose();
}

async function runHostTurn(session: HostSession): Promise<void> {
  const turn = 1;
  const attemptId = "attempt-29";
  const chunks = [
    "Host 保存 Session 事件；",
    "Gateway 通过 Remote 流转发；",
    "Client 投影后触发界面更新。",
  ];
  session.append({ type: "turn/start", data: { turn } });

  let revision = 0;
  for (const text of chunks) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    session.publishAssistantChunk({ attemptId, revision: ++revision, text });
  }

  const answer = chunks.join("");
  session.append({
    type: "assistant/message",
    data: { turn, attemptId, text: answer },
  });
  session.append({ type: "turn/end", data: { turn, reason: "completed" } });
}
