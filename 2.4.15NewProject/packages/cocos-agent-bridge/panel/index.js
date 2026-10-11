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
        .plan-card { margin: 0 0 12px; padding: 10px; border: 1px solid #4a5058; border-radius: 6px; background: #282c31; }
        .plan-card h3 { margin: 0 0 6px; font-size: 13px; }
        .plan-summary, .plan-status { color: #b9c0ca; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
        .plan-steps { padding-left: 22px; }
        .plan-steps li { padding: 4px 0; }
        .plan-detail { color: #aeb5bf; font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 4px; }
        .plan-status { margin: 8px 0; color: #d4d8de; font-size: 11px; }
        .plan-action { background: #2867bc; border-color: #3979cf; }
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
                <div class="composer-foot"><span class="hint">Enter 发送 · Shift+Enter 换行</span><button class="send" id="send">发送</button></div>
            </footer>
        </div>
    `,

    $: {
        connection: '#connection', apiKey: '#api-key', model: '#model', connect: '#connect', rememberKey: '#remember-key', forgetKey: '#forget-key',
        modeAsk: '#mode-ask', modePlan: '#mode-plan', modeAgent: '#mode-agent', modeNote: '#mode-note', messages: '#messages', empty: '#empty',
        prompt: '#prompt', send: '#send', approval: '#approval', approvalTool: '#approval-tool',
        approvalArgs: '#approval-args', approve: '#approve', reject: '#reject',
    },

    ready() {
        this._mode = 'Ask';
        this._socket = null;
        this._busy = false;
        this._requestId = null;
        this._runActivity = null;
        this._pendingApproval = null;
        this._planCards = new Map();
        this._plans = new Map();
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
        this.$prompt.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendPrompt(); }
        });
        this.$approve.addEventListener('click', () => this.answerApproval(true));
        this.$reject.addEventListener('click', () => this.answerApproval(false));
        Editor.Ipc.sendToMain('cocos-agent-bridge:assistantState');
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
        this.$send.disabled = true;
        this.$prompt.value = '';
        this.addMessage('user', text);
        this._runActivity = this.addActivity(`${this._mode} · 正在处理…`);
        this._socket.send(JSON.stringify({ type: 'run', requestId: this._requestId,
            conversationId: this._conversationId, mode: this._mode, text }));
    },

    receiveMessage(raw) {
        let message;
        try { message = JSON.parse(raw); } catch (_) { return; }
        if (message.type === 'conversation') {
            if (Array.isArray(message.messages) && this.$messages.children.length <= 1) {
                message.messages.forEach((item) => this.addMessage(item.role, item.content));
            }
            if (Array.isArray(message.plans)) message.plans.forEach((plan) => this.renderPlan(plan));
            return;
        }
        if (message.type === 'connected') return;
        if (message.requestId && message.requestId !== this._requestId) return;
        if (message.type === 'run.started') { this.addActivity(`${message.mode} · 已开始`); return; }
        if (message.type === 'model.thinking') { this.addActivity('正在联系 DeepSeek…'); return; }
        if (message.type === 'model.failed') { this.addActivity(`DeepSeek 请求失败：${message.message || '未知错误'}`); return; }
        if (message.type === 'tool.approval-required') { this.addActivity(`等待批准：${message.toolName}`); return; }
        if (message.type === 'tool.started') { this.addActivity(`${message.access === 'read' ? '读取' : '执行'}：${message.toolName}`); return; }
        if (message.type === 'tool.finished') {
            const label = message.result?.reconciliation?.disposition === 'no-effect' ? '已对账（无副作用）'
                : message.isError || message.result?.success === false ? '失败' : '完成';
            this.addActivity(`${label}：${message.toolName}\n${JSON.stringify(message.result || {}).slice(0, 900)}`);
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
        const labels = { completed: '已结束', 'needs-review': '待核对',
            'awaiting-approval': '等待批准', stopped: '已停止', failed: '失败' };
        const label = labels[status] || '已停止';
        if (this._runActivity) this._runActivity.textContent = `${this._mode} · ${label}`;
        if (reason && status !== 'completed') this.addActivity(`${label}：${reason}`);
        this._runActivity = null;
        this._busy = false;
        this._modeButtons.forEach((button) => { button.disabled = false; });
        this._requestId = null;
        this.$send.disabled = false;
        this._pendingApproval = null;
        this.$approval.classList.remove('visible');
        for (const plan of this._plans.values()) this.renderPlan(plan);
    },

    startPlanStep(plan) {
        if (this._busy || !plan || !this._socket || this._socket.readyState !== WebSocket.OPEN) return;
        this.selectMode('Agent');
        this._busy = true;
        this._modeButtons.forEach((button) => { button.disabled = true; });
        this.$send.disabled = true;
        this._requestId = makeId();
        this._runActivity = this.addActivity(`Agent · 执行计划第 ${plan.nextStepIndex + 1} 步：${plan.steps[plan.nextStepIndex].title}`);
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
});
