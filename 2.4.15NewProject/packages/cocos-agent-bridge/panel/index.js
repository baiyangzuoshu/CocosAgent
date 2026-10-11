'use strict';

function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `cocos-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

Editor.Panel.extend({
    style: `
        :host { display: block; height: 100%; color: #e7e9ec; background: #242629; font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        .root { height: 100%; min-height: 0; display: flex; flex-direction: column; }
        .top { padding: 12px; border-bottom: 1px solid #3d4045; }
        .brand { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .brand strong { font-size: 14px; letter-spacing: .2px; }
        .connection { color: #a9afb8; font-size: 11px; }
        .connection[data-state="ready"] { color: #76d39b; }
        .project-context { margin: 8px 0 10px; padding: 7px 8px; border: 1px solid #3d4249; border-radius: 5px; background: #202225; color: #c6cbd2; font-size: 10px; line-height: 1.45; }
        .project-context-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px; }
        .project-context-head strong { color: #e7e9ec; font-size: 11px; }
        .context-refresh { padding: 2px 6px; font-size: 10px; }
        .context-line { overflow-wrap: anywhere; }
        .context-muted { color: #9299a3; }
        .model-row { display: flex; gap: 6px; }
        input, select, textarea { color: #e7e9ec; background: #191a1c; border: 1px solid #464a50; border-radius: 4px; outline: none; }
        input:focus, select:focus, textarea:focus { border-color: #6ca8ff; }
        .key { flex: 1; min-width: 0; padding: 7px 8px; }
        .credential-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 5px; color: #aab1bb; font-size: 10px; }
        .remember-option { display: flex; align-items: center; gap: 5px; min-width: 0; }
        .remember-option input { margin: 0; accent-color: #3985dc; }
        .forget { padding: 3px 7px; font-size: 10px; white-space: nowrap; }
        select { padding: 6px 8px; }
        button { color: #e7e9ec; background: #373a3f; border: 1px solid #4a4e55; border-radius: 4px; padding: 6px 10px; cursor: pointer; }
        button:hover { background: #454950; }
        button:disabled { opacity: .5; cursor: default; }
        .connect { white-space: nowrap; background: #2867bc; border-color: #3979cf; }
        .connect:hover { background: #3479d0; }
        .modebar { display: flex; gap: 4px; margin-top: 10px; }
        .mode { flex: 1; color: #b8bdc5; background: transparent; border-color: transparent; }
        .mode.active { color: #fff; background: #3a3e44; border-color: #4b5058; }
        .mode-note { color: #969da7; font-size: 11px; min-height: 15px; margin-top: 6px; }
        .messages { flex: 1; min-height: 0; overflow: auto; padding: 12px; }
        .empty { color: #9ca3ad; line-height: 1.55; margin: 10px 2px; }
        .message { margin: 0 0 12px; padding: 9px 10px; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; }
        .message.user { background: #343941; margin-left: 22px; }
        .message.assistant { background: #2d3034; margin-right: 12px; }
        .message .role { color: #aeb5bf; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
        .activity { color: #aab1bb; font-size: 11px; margin: 4px 2px 8px; white-space: pre-wrap; }
        .runtime-screenshot { display: block; max-width: 100%; max-height: 420px; object-fit: contain; margin: 4px 2px 12px; border: 1px solid #4a5058; border-radius: 4px; background: #17181a; }
        .plan-card { margin: 0 0 12px; padding: 10px; border: 1px solid #4a5058; border-radius: 6px; background: #282c31; }
        .plan-card h3 { margin: 0 0 6px; font-size: 13px; }
        .plan-summary, .plan-status { color: #b9c0ca; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
        .plan-steps { padding-left: 22px; }
        .plan-steps li { padding: 4px 0; }
        .plan-detail { color: #aeb5bf; font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 4px; }
        .plan-status { margin: 8px 0; color: #d4d8de; font-size: 11px; }
        .plan-action { background: #2867bc; border-color: #3979cf; }
        .run-card { margin: 0 0 10px; padding: 9px; border: 1px solid #57504a; border-radius: 6px; background: #302d29; }
        .run-card h4 { margin: 0 0 5px; font-size: 12px; }
        .run-meta, .run-effects { color: #c2c0ba; font-size: 10px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
        .run-recover { margin: 5px 5px 0 0; padding: 3px 6px; font-size: 10px; }
        .run-receipt { max-height: 180px; overflow: auto; color: #c2c0ba; font: 10px Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
        .diff-details { margin-top: 5px; font-size: 10px; }
        .diff-details summary { color: #9fc5ff; cursor: pointer; }
        .diff-details pre { max-height: 180px; overflow: auto; color: #cdd2da; white-space: pre-wrap; overflow-wrap: anywhere; }
        .approval { display: none; padding: 10px 12px; border-top: 1px solid #615438; background: #312c22; }
        .approval.visible { display: block; }
        .approval-title { color: #f2d084; font-weight: 600; margin-bottom: 5px; }
        .approval-tool { font-family: Consolas, monospace; font-size: 11px; margin: 5px 0; }
        .approval-args { max-height: 120px; overflow: auto; color: #c4c0b5; font: 10px Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
        .approval-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
        .approve { background: #367e4e; border-color: #4c9e67; }
        .composer { border-top: 1px solid #3d4045; padding: 10px 12px 12px; }
        .composer textarea { display: block; width: 100%; min-height: 72px; max-height: 180px; resize: vertical; padding: 8px; line-height: 1.4; }
        .composer-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 7px; }
        .hint { color: #9097a1; font-size: 10px; }
        .send { min-width: 72px; background: #2867bc; border-color: #3979cf; }
        .send-row { display: flex; justify-content: flex-end; }
    `,

    template: `
        <div class="root">
            <header class="top">
                <div class="brand"><strong>CocosAgent</strong><span class="connection" id="connection">未连接</span></div>
                <div class="project-context" id="project-context">
                    <div class="project-context-head"><strong>当前工程上下文</strong><button class="context-refresh" id="context-refresh">刷新</button></div>
                    <div class="context-line" id="context-project">正在读取工程…</div>
                    <div class="context-line" id="context-scene">活动场景：读取中…</div>
                    <div class="context-line" id="context-selection">选中对象：读取中…</div>
                    <div class="context-line context-muted" id="context-conventions">项目约定：读取中…</div>
                </div>
                <div class="model-row">
                    <input id="api-key" class="key" type="password" autocomplete="off" placeholder="DeepSeek API Key（连接后清空）" />
                    <select id="model" aria-label="DeepSeek 模型">
                        <option value="deepseek-flash">DeepSeek Flash</option>
                        <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
                    </select>
                    <button id="connect" class="connect">连接</button>
                </div>
                <div class="credential-row">
                    <label class="remember-option"><input id="remember-key" type="checkbox" checked />保存到本机用户配置</label>
                    <button id="forget-key" class="forget">忘记 Key</button>
                </div>
                <div class="modebar" role="tablist" aria-label="Agent 模式">
                    <button class="mode active" id="mode-ask" data-mode="Ask" role="tab">Ask</button>
                    <button class="mode" id="mode-plan" data-mode="Plan" role="tab">Plan</button>
                    <button class="mode" id="mode-agent" data-mode="Agent" role="tab">Agent</button>
                </div>
                <div class="mode-note" id="mode-note">只读询问工程、场景和资源。</div>
            </header>
            <section class="messages" id="messages" aria-live="polite">
                <div class="empty" id="empty">选择模式并连接 DeepSeek，然后直接用自然语言描述你要了解或完成的工作。</div>
            </section>
            <section class="approval" id="approval">
                <div class="approval-title">Agent 请求执行一项编辑器操作</div>
                <div class="approval-tool" id="approval-tool"></div>
                <pre class="approval-args" id="approval-args"></pre>
                <div class="approval-actions"><button id="reject">拒绝</button><button id="approve" class="approve">批准并执行</button></div>
            </section>
            <footer class="composer">
                <textarea id="prompt" maxlength="8000" placeholder="向 CocosAgent 提问…"></textarea>
                <div class="composer-foot"><span class="hint">Enter 发送 · Shift+Enter 换行</span><div><button id="cancel-run" hidden>停止任务</button> <button class="send" id="send">发送</button></div></div>
            </footer>
        </div>
    `,

    $: {
        connection: '#connection', apiKey: '#api-key', model: '#model', connect: '#connect', rememberKey: '#remember-key', forgetKey: '#forget-key',
        projectContext: '#project-context', contextRefresh: '#context-refresh', contextProject: '#context-project', contextScene: '#context-scene',
        contextSelection: '#context-selection', contextConventions: '#context-conventions',
        modeAsk: '#mode-ask', modePlan: '#mode-plan', modeAgent: '#mode-agent', modeNote: '#mode-note', messages: '#messages', empty: '#empty',
        prompt: '#prompt', send: '#send', cancelRun: '#cancel-run', approval: '#approval', approvalTool: '#approval-tool',
        approvalArgs: '#approval-args', approve: '#approve', reject: '#reject',
    },

    ready() {
        this._mode = 'Ask';
        this._socket = null;
        this._busy = false;
        this._requestId = null;
        this._requestSent = false;
        this._cancelRequested = false;
        this._runActivity = null;
        this._pendingApproval = null;
        this._planCards = new Map();
        this._plans = new Map();
        this._runCards = new Map();
        this._projectContext = null;
        this._conversationId = localStorage.getItem('cocos-agent-assistant-conversation') || makeId();
        localStorage.setItem('cocos-agent-assistant-conversation', this._conversationId);
        this._modeButtons = [this.$modeAsk, this.$modePlan, this.$modeAgent];
        this._modeButtons.forEach((button) => button.addEventListener('click', () => this.selectMode(button.dataset.mode)));
        this.$connect.addEventListener('click', () => this.startRuntime());
        this.$forgetKey.addEventListener('click', () => {
            this.$forgetKey.disabled = true;
            Editor.Ipc.sendToMain('cocos-agent-bridge:assistantCredentialForget');
        });
        this.$send.addEventListener('click', () => this.sendPrompt());
        this.$cancelRun.addEventListener('click', () => this.cancelRun());
        this.$contextRefresh.addEventListener('click', () => this.refreshProjectContext());
        this.$prompt.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendPrompt(); }
        });
        this.$approve.addEventListener('click', () => this.answerApproval(true));
        this.$reject.addEventListener('click', () => this.answerApproval(false));
        Editor.Ipc.sendToMain('cocos-agent-bridge:assistantState');
        this.refreshProjectContext();
    },

    messages: {
        'assistant-runtime-ready'(_event, payload) {
            this.connectRuntime(payload);
        },
        'assistant-runtime-state'(_event, payload) {
            if (payload && payload.ready) this.connectRuntime(payload);
            else if (payload && payload.connecting) {
                this.$connect.disabled = true;
                this.setConnection('正在恢复本机加密凭据…', '');
            }
            else if (payload && payload.error) {
                this.$connect.disabled = false;
                this.setConnection(payload.error, 'error');
            }
        },
        'assistant-runtime-error'(_event, payload) {
            this.$connect.disabled = false;
            this.setConnection(payload?.message || 'Agent 服务启动失败', 'error');
        },
        'assistant-runtime-stopped'() {
            this.$connect.disabled = false;
            this.setConnection('Agent 服务已停止', '');
        },
        'assistant-credential-forgotten'() {
            this.$rememberKey.checked = false;
            this.$forgetKey.disabled = false;
            this.$connect.disabled = false;
            this.setConnection('已忘记 Key，请重新输入后连接', '');
        },
    },

    selectMode(mode) {
        if (!['Ask', 'Plan', 'Agent'].includes(mode)) return;
        this._mode = mode;
        this._modeButtons.forEach((button) => {
            button.classList.toggle('active', button.dataset.mode === mode);
            button.disabled = this._busy;
        });
        this.$modeNote.textContent = mode === 'Ask' ? '只读询问工程、场景和资源。'
            : mode === 'Plan' ? '读取工程状态并生成计划，不会修改项目。'
                : '执行任务前会显示具体工具和参数，等待你批准。';
        this.$prompt.placeholder = mode === 'Ask' ? '向 CocosAgent 提问…'
            : mode === 'Plan' ? '描述你想完成的工作，让 CocosAgent 先列出计划…'
                : '描述你要 Agent 执行的工作…';
    },

    setConnection(text, state) {
        this.$connection.textContent = text;
        this.$connection.dataset.state = state || '';
    },

    startRuntime() {
        const apiKey = this.$apiKey.value.trim();
        if (!apiKey && !this.$rememberKey.checked) { this.setConnection('请输入 DeepSeek API Key', 'error'); this.$apiKey.focus(); return; }
        this.setConnection('正在启动本地 Agent…', '');
        this.$connect.disabled = true;
        Editor.Ipc.sendToMain('cocos-agent-bridge:assistantStart', { apiKey, model: this.$model.value, remember: this.$rememberKey.checked });
    },

    connectRuntime(payload) {
        if (!payload || !Number.isInteger(payload.port) || typeof payload.token !== 'string') return;
        this.$apiKey.value = '';
        if (typeof payload.model === 'string') this.$model.value = payload.model;
        if (typeof payload.credentialRemembered === 'boolean') this.$rememberKey.checked = payload.credentialRemembered;
        this.$connect.disabled = false;
        this.$forgetKey.disabled = false;
        if (this._socket && this._socket.readyState <= 1) this._socket.close();
        const socket = new WebSocket(`ws://127.0.0.1:${payload.port}/assistant/${payload.token}`);
        this._socket = socket;
        socket.addEventListener('open', () => {
            this.setConnection(`已连接 · ${payload.model || 'DeepSeek'}${payload.credentialRemembered ? ' · Key 已保存在本机' : ''}`, 'ready');
            socket.send(JSON.stringify({ type: 'resume', conversationId: this._conversationId }));
        });
        socket.addEventListener('message', (event) => this.receiveMessage(event.data));
        socket.addEventListener('close', () => {
            if (this._socket === socket) {
                this.setConnection('连接已关闭', '');
                if (this._busy) this.finishRun('连接中断；继续操作前请先查询操作回执');
            }
            this.$connect.disabled = false;
        });
        socket.addEventListener('error', () => {
            this.setConnection('无法连接本地 Agent 服务', 'error');
            this.$connect.disabled = false;
        });
    },

    sendPrompt() {
        const text = this.$prompt.value.trim();
        if (!text || this._busy) return;
        if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
            this.setConnection('先连接 DeepSeek', 'error');
            return;
        }
        this._busy = true;
        this._modeButtons.forEach((button) => { button.disabled = true; });
        this._requestId = makeId();
        const requestId = this._requestId;
        this._requestSent = false;
        this._cancelRequested = false;
        this.$send.disabled = true;
        this.$cancelRun.hidden = false;
        this.$cancelRun.disabled = false;
        this.$cancelRun.textContent = '停止任务';
        this.$prompt.value = '';
        this.addMessage('user', text);
        this._runActivity = this.addActivity(`${this._mode} · 正在刷新工程上下文…`);
        this.refreshProjectContext((error) => {
            if (this._requestId !== requestId) return;
            if (error) { this.finishRun(`工程上下文读取失败：${error.message || error}`, 'failed'); return; }
            if (this._cancelRequested) { this.finishRun('已在发送任务前取消；Agent 未收到请求。', 'cancelled'); return; }
            if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
                this.finishRun('本地 Agent 连接已断开；请先重新连接。', 'failed'); return;
            }
            if (this._runActivity) this._runActivity.textContent = `${this._mode} · 正在处理…`;
            this._requestSent = true;
            this._socket.send(JSON.stringify({ type: 'run', requestId,
                conversationId: this._conversationId, mode: this._mode, text,
                projectContext: this._projectContext }));
        });
    },

    refreshProjectContext(done) {
        if (this.$contextRefresh) this.$contextRefresh.disabled = true;
        if (!this._projectContext) {
            this.$contextProject.textContent = '正在读取工程…';
            this.$contextScene.textContent = '活动场景：读取中…';
            this.$contextSelection.textContent = '选中对象：读取中…';
            this.$contextConventions.textContent = '项目约定：读取中…';
        }
        Editor.Ipc.sendToMain('cocos-agent-bridge:projectContextGet', (error, context) => {
            if (this.$contextRefresh) this.$contextRefresh.disabled = false;
            if (error || !context) {
                const failure = error || new Error('没有收到工程上下文回执。');
                this.$contextProject.textContent = '工程上下文不可用';
                this.$contextScene.textContent = '活动场景：未知';
                this.$contextSelection.textContent = '选中对象：未知';
                this.$contextConventions.textContent = '项目约定：未读取';
                if (typeof done === 'function') done(failure);
                return;
            }
            this._projectContext = context;
            const projectName = context.projectName || '未命名工程';
            this.$contextProject.textContent = `${projectName} · Creator ${context.creatorVersion || '未知版本'}`;
            this.$contextProject.title = context.projectRoot || '';
            this.$contextScene.textContent = `活动场景：${context.activeScene || '无活动场景'}`;
            const selected = Array.isArray(context.selectedNodes) ? context.selectedNodes : [];
            const found = selected.filter((item) => item.status === 'found');
            this.$contextSelection.textContent = found.length
                ? `选中对象：${found.map((item) => `${item.path} [${(item.components || []).join(', ') || '无组件'}]`).join('；')}`
                : `选中对象：${context.selectionStatus === 'read' ? '无' : '不可用'}`;
            this.$contextConventions.textContent = context.projectConventions?.status === 'available'
                ? `项目约定：AGENTS.md 已就绪 · SHA-256 ${String(context.projectConventions.sha256 || '').slice(0, 12)}`
                : `项目约定：${context.projectConventions?.status === 'missing' ? '未找到 AGENTS.md' : '不可用'}`;
            if (typeof done === 'function') done(null, context);
        });
    },

    receiveMessage(raw) {
        let message;
        try { message = JSON.parse(raw); } catch (_) { return; }
        if (message.type === 'conversation') {
            if (Array.isArray(message.messages) && this.$messages.children.length <= 1) {
                message.messages.forEach((item) => this.addMessage(item.role, item.content));
            }
            if (Array.isArray(message.plans)) message.plans.forEach((plan) => this.renderPlan(plan));
            if (Array.isArray(message.recentRuns)) message.recentRuns.forEach((run) => this.renderRecentRun(run));
            return;
        }
        if (message.type === 'connected') return;
        if (message.requestId && message.requestId !== this._requestId) return;
        if (message.type === 'run.started') { this.addActivity(`${message.mode} · 已开始`); return; }
        if (message.type === 'run.cancelling') { this.addActivity(message.message || '正在安全停止…'); return; }
        if (message.type === 'run.cancel.rejected') { this.addActivity(`无法停止：${message.reason || '任务已结束'}`); return; }
        if (message.type === 'run.persistence-error') {
            this.addActivity('本地会话状态写入失败，Agent 已停止后续调度；请核对上方已有回执和 Creator 操作记录。');
            return;
        }
        if (message.type === 'run.recovery.result') { this.renderRecoveryResult(message); return; }
        if (message.type === 'model.thinking') { this.addActivity('正在联系 DeepSeek…'); return; }
        if (message.type === 'context.compacted') {
            const report = message.report || {};
            const identities = Array.isArray(report.operationIdentities) ? report.operationIdentities.length : 0;
            const pending = Array.isArray(report.outstandingAcceptance) ? report.outstandingAcceptance.length : 0;
            const compactedResults = report.compactedToolResults || 0;
            this.addActivity(`上下文已压缩：${report.summarizedToolCalls || 0} 次旧工具调用已建立回执索引，另缩短 ${compactedResults} 条只读回执；保留 ${identities} 个操作身份和 ${pending} 项待验收/恢复状态。`);
            return;
        }
        if (message.type === 'context.budget-exceeded') {
            const report = message.report || {};
            this.addActivity(`上下文仍超出预算（估算 ${report.estimatedTokens || '?'} / ${report.maxEstimatedTokens || '?'} tokens）；Agent 已停止后续模型调用。`);
            return;
        }
        if (message.type === 'model.failed') { this.addActivity(`DeepSeek 请求失败：${message.message || '未知错误'}`); return; }
        if (message.type === 'tool.approval-required') { this.addActivity(`等待批准：${message.toolName}`); return; }
        if (message.type === 'tool.started') { this.addActivity(`${message.access === 'read' ? '读取' : '执行'}：${message.toolName}`); return; }
        if (message.type === 'tool.finished') {
            const label = message.result?.reconciliation?.disposition === 'no-effect' ? '已对账（无副作用）'
                : message.isError || message.result?.success === false ? '失败' : '完成';
            const result = message.result || {};
            const imageDataUrl = result.imageDataUrl;
            const details = { ...result };
            delete details.imageDataUrl;
            let summary;
            if (result.runtime && result.diagnostics) {
                const diagnostics = result.diagnostics;
                const lines = [
                    `${result.scene?.name || '场景'} · ${result.runtime.status} · 帧 ${result.runtime.frameCount}（采样推进 ${result.runtime.frameDelta}）`,
                    `错误：${(diagnostics.errors || []).slice(0, 8).map((item) => item.message).join('；') || '无'}`,
                    `警告：${(diagnostics.warnings || []).slice(0, 8).map((item) => item.message).join('；') || '无'}`,
                    `日志：${(diagnostics.logs || []).slice(0, 8).map((item) => item.message).join('；') || '无'}`,
                ];
                if (result.targetNode) lines.push(`目标节点：${result.targetNode.path} · ${result.targetNode.active ? '启用' : '未启用'}`);
                if (result.screenshot) lines.push(`画面：${result.screenshot.available ? '已截取' : '不可用'}`);
                summary = `${label}：${message.toolName}\n${lines.join('\n')}`;
            } else summary = `${label}：${message.toolName}\n${JSON.stringify(details).slice(0, 900)}`;
            const activity = this.addActivity(summary);
            const diff = result.expectedDiff || result.script?.expectedDiff;
            if (diff !== undefined) this.appendDiffDetails(activity, diff);
            if (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/jpeg;base64,')
                && imageDataUrl.length <= 2 * 1024 * 1024 * 4 / 3 + 64) {
                const image = document.createElement('img');
                image.className = 'runtime-screenshot';
                image.alt = 'Creator 运行画布截图';
                image.src = imageDataUrl;
                this.$messages.appendChild(image);
                this.$messages.scrollTop = this.$messages.scrollHeight;
            }
            return;
        }
        if (message.type === 'approval.required') { this.showApproval(message); return; }
        if (message.type === 'run.rejected') { this.finishRun(message.reason); return; }
        if (message.type === 'run.failed') {
            this.addMessage('assistant', message.message || '请求失败');
            if (message.planProgress) this.renderPlan(message.planProgress);
            this.finishRun(message.message, 'failed');
            return;
        }
        if (message.type === 'run.result') {
            this.addMessage('assistant', message.result?.finalText || '任务已结束。');
            if (message.result?.plan) this.renderPlan(message.result.plan);
            if (message.result?.planProgress) this.renderPlan(message.result.planProgress);
            if (Array.isArray(message.result?.recentRuns)) message.result.recentRuns.forEach((run) => this.renderRecentRun(run));
            if (message.result?.tracePath) this.addActivity(`记录：${message.result.tracePath}`);
            this.finishRun(message.result?.reason, message.result?.status || 'stopped');
        }
    },

    showApproval(message) {
        this._pendingApproval = message.approvalId;
        this.$approvalTool.textContent = message.toolName;
        this.$approvalArgs.textContent = JSON.stringify(message.arguments, null, 2);
        this.$approval.classList.add('visible');
        this.addActivity('Agent 等待你的操作批准。');
    },

    answerApproval(approved) {
        if (!this._pendingApproval || !this._socket || this._socket.readyState !== WebSocket.OPEN) return;
        this._socket.send(JSON.stringify({ type: 'approval', approvalId: this._pendingApproval, approved }));
        this._pendingApproval = null;
        this.$approval.classList.remove('visible');
        this.addActivity(approved ? '已批准。' : '已拒绝。');
    },

    finishRun(reason, status = 'stopped') {
        const labels = { completed: '已结束', cancelled: '已取消', 'needs-review': '待核对',
            'awaiting-approval': '等待批准', stopped: '已停止', failed: '失败' };
        const label = labels[status] || '已停止';
        if (this._runActivity) this._runActivity.textContent = `${this._mode} · ${label}`;
        if (reason && status !== 'completed') this.addActivity(`${label}：${reason}`);
        this._runActivity = null;
        this._busy = false;
        this.$cancelRun.hidden = true;
        this.$cancelRun.disabled = false;
        this.$cancelRun.textContent = '停止任务';
        this._modeButtons.forEach((button) => { button.disabled = false; });
        this._requestId = null;
        this._requestSent = false;
        this._cancelRequested = false;
        this.$send.disabled = false;
        this._pendingApproval = null;
        this.$approval.classList.remove('visible');
        for (const plan of this._plans.values()) this.renderPlan(plan);
    },

    cancelRun() {
        if (!this._busy || !this._requestId || !this._socket || this._socket.readyState !== WebSocket.OPEN) return;
        if (!this._requestSent) {
            this._cancelRequested = true;
            this.finishRun('已在发送任务前取消；Agent 未收到请求。', 'cancelled');
            return;
        }
        this.$cancelRun.disabled = true;
        this.$cancelRun.textContent = '正在停止…';
        this._socket.send(JSON.stringify({ type: 'run.cancel', requestId: this._requestId }));
    },

    startPlanStep(plan) {
        if (this._busy || !plan || !this._socket || this._socket.readyState !== WebSocket.OPEN) return;
        this.selectMode('Agent');
        this._busy = true;
        this._modeButtons.forEach((button) => { button.disabled = true; });
        this.$send.disabled = true;
        this.$cancelRun.hidden = false;
        this.$cancelRun.disabled = false;
        this.$cancelRun.textContent = '停止任务';
        this._requestId = makeId();
        this._runActivity = this.addActivity(`Agent · 执行计划第 ${plan.nextStepIndex + 1} 步：${plan.steps[plan.nextStepIndex].title}`);
        this._requestSent = true;
        this._cancelRequested = false;
        this.renderPlan({ ...plan, status: 'running' });
        this._socket.send(JSON.stringify({ type: 'run', requestId: this._requestId,
            conversationId: this._conversationId, mode: 'Agent',
            planExecution: { planId: plan.id, stepIndex: plan.nextStepIndex } }));
    },

    renderPlan(plan) {
        if (!plan || !Array.isArray(plan.steps)) return;
        this._plans.set(plan.id, plan);
        const card = document.createElement('section');
        card.className = 'plan-card';
        const title = document.createElement('h3');
        title.textContent = plan.title;
        card.appendChild(title);
        const summary = document.createElement('div');
        summary.className = 'plan-summary';
        summary.textContent = plan.summary;
        card.appendChild(summary);
        const list = document.createElement('ol');
        list.className = 'plan-steps';
        plan.steps.forEach((step) => {
            const item = document.createElement('li');
            item.textContent = step.title;
            const detail = document.createElement('div');
            detail.className = 'plan-detail';
            detail.textContent = `${step.description}\n前置条件：${step.preconditions.join('；') || '无'}\n必需工具：${step.requiredTools.join('、')}\n验证：${step.validation}\n恢复：${step.recovery}`;
            const evidence = (plan.stepEvidence || []).find((item) => item.stepIndex === plan.steps.indexOf(step));
            if (evidence) detail.textContent += `\n已发生的副作用与回执：\n${JSON.stringify(evidence.receipts || [], null, 2).slice(0, 4000)}`;
            item.appendChild(detail);
            list.appendChild(item);
        });
        card.appendChild(list);
        const status = document.createElement('div');
        status.className = 'plan-status';
        const labels = { proposed: '计划待你确认', running: `正在执行第 ${(plan.nextStepIndex || 0) + 1} 步`,
            'waiting-next': `已完成 ${plan.completedSteps}/${plan.steps.length} 步`,
            paused: '当前步骤未完成，可重试；写入仍需单独批准',
            'needs-review': '执行结果不确定，已锁定计划；请先在 Agent 模式核对操作回执',
            completed: '计划全部步骤已完成' };
        status.textContent = labels[plan.status] || '计划状态未知';
        card.appendChild(status);
        const canStart = ['proposed', 'waiting-next', 'paused'].includes(plan.status) && plan.nextStepIndex < plan.steps.length;
        if (canStart) {
            const button = document.createElement('button');
            button.className = 'plan-action';
            button.textContent = plan.status === 'proposed' ? `开始第 ${plan.nextStepIndex + 1} 步`
                : plan.status === 'paused' ? `重试第 ${plan.nextStepIndex + 1} 步` : `继续第 ${plan.nextStepIndex + 1} 步`;
            button.disabled = this._busy;
            button.addEventListener('click', () => this.startPlanStep(plan));
            card.appendChild(button);
        }
        const previous = this._planCards.get(plan.id);
        if (previous && previous.parentNode) previous.parentNode.replaceChild(card, previous);
        else this.$messages.appendChild(card);
        this._planCards.set(plan.id, card);
        this.$messages.scrollTop = this.$messages.scrollHeight;
    },

    addMessage(role, text) {
        if (this.$empty && this.$empty.parentNode) this.$empty.parentNode.removeChild(this.$empty);
        if (!['user', 'assistant'].includes(role) || typeof text !== 'string') return;
        const article = document.createElement('article');
        article.className = `message ${role}`;
        const label = document.createElement('span');
        label.className = 'role';
        label.textContent = role === 'user' ? 'You' : 'CocosAgent';
        const body = document.createElement('div');
        body.textContent = text;
        article.appendChild(label);
        article.appendChild(body);
        this.$messages.appendChild(article);
        this.$messages.scrollTop = this.$messages.scrollHeight;
    },

    addActivity(text) {
        const item = document.createElement('div');
        item.className = 'activity';
        item.textContent = text;
        this.$messages.appendChild(item);
        this.$messages.scrollTop = this.$messages.scrollHeight;
        return item;
    },

    appendDiffDetails(container, diff) {
        if (!container || diff === undefined) return;
        const details = document.createElement('details');
        details.className = 'diff-details';
        const summary = document.createElement('summary');
        summary.textContent = '查看预期差异';
        const pre = document.createElement('pre');
        let serialized;
        try { serialized = JSON.stringify(diff, null, 2); } catch (_) { serialized = String(diff); }
        pre.textContent = (serialized || '').slice(0, 12000);
        details.appendChild(summary);
        details.appendChild(pre);
        container.appendChild(details);
    },

    renderRecentRun(run) {
        if (!run || typeof run.id !== 'string') return;
        const card = document.createElement('section');
        card.className = 'run-card';
        const title = document.createElement('h4');
        const statusLabels = { completed: '已完成', 'needs-review': '需要核对', interrupted: '服务重启中断', cancelled: '已取消' };
        title.textContent = `${statusLabels[run.status] || run.status || '任务'} · ${(run.task || '').slice(0, 180)}`;
        card.appendChild(title);
        const meta = document.createElement('div');
        meta.className = 'run-meta';
        meta.textContent = `${run.mode || 'Agent'} · ${run.updatedAt || run.startedAt || ''}${run.reason ? ` · ${run.reason}` : ''}`;
        card.appendChild(meta);
        const receipts = Array.isArray(run.receipts) ? run.receipts : [];
        receipts.forEach((receipt) => {
            if (receipt.expectedDiff !== undefined) this.appendDiffDetails(card, receipt.expectedDiff);
        });
        const effects = receipts.filter((receipt) => receipt.access !== 'read'
            && (receipt.success === true || receipt.sideEffect === 'possible' || receipt.sideEffect === 'unknown'
                || receipt.outcome === 'needs-review'));
        const effectLine = document.createElement('div');
        effectLine.className = 'run-effects';
        const activeWrite = run.activeTool && run.activeTool.access !== 'read' ? run.activeTool : null;
        effectLine.textContent = effects.length || activeWrite ? `已发生或可能发生的写入：\n${[
            ...effects.map((receipt) =>
            `${receipt.toolName || '未知工具'} · ${receipt.outcome || (receipt.success ? '成功回执' : '结果未知')}`
            + `${receipt.operationId ? ` · 操作 ${receipt.operationId}` : ''}`
            + `${receipt.sideEffect ? ` · 副作用 ${receipt.sideEffect}` : ''}`),
            ...(activeWrite ? [`中断时正在执行 ${activeWrite.toolName || '未知工具'}；结果尚未读回${activeWrite.operationId ? ` · 操作 ${activeWrite.operationId}` : ''}`] : []),
        ].join('\n')}` : '已记录：没有得到写入回执。';
        card.appendChild(effectLine);
        const recoveryTargets = [...receipts, ...(run.activeTool?.operationId ? [run.activeTool] : [])];
        const seenOperations = new Set();
        for (const receipt of recoveryTargets) {
            if (!receipt.operationId || seenOperations.has(receipt.operationId)) continue;
            seenOperations.add(receipt.operationId);
            const button = document.createElement('button');
            button.className = 'run-recover';
            button.textContent = `只读核对 ${receipt.operationId.slice(0, 8)}`;
            button.addEventListener('click', () => {
                if (this._socket && this._socket.readyState === WebSocket.OPEN) this._socket.send(JSON.stringify({
                    type: 'run.recover', conversationId: run.conversationId, runId: run.id, operationId: receipt.operationId,
                }));
            });
            card.appendChild(button);
        }
        if (run.recovery) {
            const pre = document.createElement('pre');
            pre.className = 'run-receipt';
            pre.textContent = `最近读回：${JSON.stringify(run.recovery.receipt || run.recovery, null, 2).slice(0, 5000)}`;
            card.appendChild(pre);
        }
        const previous = this._runCards.get(run.id);
        if (previous?.parentNode) previous.parentNode.replaceChild(card, previous);
        else this.$messages.appendChild(card);
        this._runCards.set(run.id, card);
    },

    renderRecoveryResult(message) {
        const run = { id: message.runId, status: message.error ? '核对失败' : '操作记录已读回',
            task: `操作 ${message.operationId}`, updatedAt: new Date().toISOString(),
            receipts: [{ toolName: 'read-only recovery', operationId: message.operationId,
                access: 'read', success: !message.error }],
            recovery: { operationId: message.operationId, checkedAt: new Date().toISOString(),
                receipt: message.receipt || { error: message.error } } };
        const previous = this._runCards.get(run.id);
        if (previous?.parentNode) {
            const pre = document.createElement('pre');
            pre.className = 'run-receipt';
            pre.textContent = `只读核对结果：${JSON.stringify(message.receipt || { error: message.error }, null, 2).slice(0, 5000)}`;
            previous.appendChild(pre);
        } else this.renderRecentRun(run);
    },
});
