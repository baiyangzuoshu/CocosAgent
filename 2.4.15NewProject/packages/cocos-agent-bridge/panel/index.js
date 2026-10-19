'use strict';

function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `cocos-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clearChildren(element) {
    while (element && element.firstChild) element.removeChild(element.firstChild);
}

function usagePurposeLabel(request) {
    if (request.purpose === 'summary') return request.summaryKind === 'conversation' ? '会话摘要' : '上下文摘要';
    return request.purpose === 'task-understanding' ? '任务理解' : '主循环';
}

function usageMetric(group, key) {
    const count = group && group.totals && group.totals[key];
    if (!Number.isSafeInteger(count) || count < 0) return '未知';
    const coverage = group.coverage && group.coverage[key];
    return count.toLocaleString() + (Number.isSafeInteger(coverage) && coverage < group.requestCount
        ? `（${coverage}/${group.requestCount} 次有数据）` : '');
}

function safeSupportText(value) {
    return String(value || '')
        .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
        .replace(/\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi, 'Bearer [REDACTED]')
        .replace(/((?:api[\s_-]?key|authorization|access[\s_-]?token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

function visibleText(element) {
    if (!element) return '';
    const copy = element.cloneNode(true);
    const controls = copy.querySelectorAll('button, .copy-button');
    Array.prototype.slice.call(controls).forEach((control) => {
        if (control.parentNode) control.parentNode.removeChild(control);
    });
    return safeSupportText(String(copy.innerText || copy.textContent || '').trim());
}

function appendInlineMarkdown(parent, text) {
    const token = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\*([^*\n]+)\*|_([^_\n]+)_/g;
    let offset = 0;
    let match;
    while ((match = token.exec(text))) {
        if (match.index > offset) parent.appendChild(document.createTextNode(text.slice(offset, match.index)));
        let node;
        if (match[1] !== undefined) {
            node = document.createElement('a');
            node.textContent = match[1];
            node.href = match[2];
            node.target = '_blank';
            node.rel = 'noopener noreferrer';
        } else if (match[3] !== undefined) {
            node = document.createElement('code');
            node.textContent = match[3];
        } else if (match[4] !== undefined || match[5] !== undefined) {
            node = document.createElement('strong');
            node.textContent = match[4] || match[5];
        } else if (match[6] !== undefined) {
            node = document.createElement('del');
            node.textContent = match[6];
        } else {
            node = document.createElement('em');
            node.textContent = match[7] || match[8];
        }
        parent.appendChild(node);
        offset = token.lastIndex;
    }
    if (offset < text.length) parent.appendChild(document.createTextNode(text.slice(offset)));
}

function markdownTableCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function renderAssistantMarkdown(container, markdown) {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    const isTableRule = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
    const isList = (line) => /^\s*(?:[-+*]|\d+[.)])\s+/.test(line);
    const isBlockStart = (index) => {
        const line = lines[index] || '';
        return /^\s*```/.test(line) || /^\s{0,3}#{1,6}\s+/.test(line)
            || /^\s{0,3}(?:---+|\*\*\*|___)\s*$/.test(line) || /^\s*>/.test(line)
            || isList(line) || (line.includes('|') && isTableRule(lines[index + 1] || ''));
    };
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) { index += 1; continue; }
        const codeFence = line.match(/^\s*```([\w#+.-]*)/);
        if (codeFence) {
            index += 1;
            const code = [];
            while (index < lines.length && !/^\s*```/.test(lines[index])) code.push(lines[index++]);
            if (index < lines.length) index += 1;
            const block = document.createElement('div');
            block.className = 'code-block';
            if (codeFence[1]) {
                const language = document.createElement('div');
                language.className = 'code-language';
                language.textContent = codeFence[1];
                block.appendChild(language);
            }
            const pre = document.createElement('pre');
            const codeNode = document.createElement('code');
            codeNode.textContent = code.join('\n');
            pre.appendChild(codeNode);
            block.appendChild(pre);
            container.appendChild(block);
            continue;
        }
        const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (heading) {
            const node = document.createElement(`h${Math.min(heading[1].length, 4)}`);
            appendInlineMarkdown(node, heading[2]);
            container.appendChild(node);
            index += 1;
            continue;
        }
        if (/^\s{0,3}(?:---+|\*\*\*|___)\s*$/.test(line)) {
            container.appendChild(document.createElement('hr'));
            index += 1;
            continue;
        }
        if (line.includes('|') && isTableRule(lines[index + 1] || '')) {
            const headers = markdownTableCells(line);
            index += 2;
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headers.forEach((cell) => {
                const th = document.createElement('th');
                appendInlineMarkdown(th, cell);
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                const cells = markdownTableCells(lines[index++]);
                const row = document.createElement('tr');
                headers.forEach((_header, cellIndex) => {
                    const td = document.createElement('td');
                    appendInlineMarkdown(td, cells[cellIndex] || '');
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            }
            table.appendChild(tbody);
            const wrap = document.createElement('div');
            wrap.className = 'markdown-table-wrap';
            wrap.appendChild(table);
            container.appendChild(wrap);
            continue;
        }
        if (/^\s*>/.test(line)) {
            const quote = document.createElement('blockquote');
            while (index < lines.length && /^\s*>/.test(lines[index])) {
                const row = document.createElement('p');
                appendInlineMarkdown(row, lines[index++].replace(/^\s*>\s?/, ''));
                quote.appendChild(row);
            }
            container.appendChild(quote);
            continue;
        }
        if (isList(line)) {
            const ordered = /^\s*\d+[.)]\s+/.test(line);
            const list = document.createElement(ordered ? 'ol' : 'ul');
            while (index < lines.length && isList(lines[index]) && /^\s*\d+[.)]\s+/.test(lines[index]) === ordered) {
                const item = document.createElement('li');
                appendInlineMarkdown(item, lines[index++].replace(/^\s*(?:[-+*]|\d+[.)])\s+/, ''));
                list.appendChild(item);
            }
            container.appendChild(list);
            continue;
        }
        const paragraph = document.createElement('p');
        const paragraphLines = [];
        while (index < lines.length && lines[index].trim() && !isBlockStart(index)) paragraphLines.push(lines[index++]);
        if (!paragraphLines.length) paragraphLines.push(lines[index++]);
        paragraphLines.forEach((part, partIndex) => {
            if (partIndex) {
                const hardBreak = /(?: {2,}|\\)$/.test(paragraphLines[partIndex - 1]);
                paragraph.appendChild(hardBreak ? document.createElement('br') : document.createTextNode(' '));
            }
            appendInlineMarkdown(paragraph, part.replace(/(?: {2,}|\\)$/, ''));
        });
        container.appendChild(paragraph);
    }
}

function describeTaskIntent(intent) {
    const kinds = { explain: '解释', read: '只读检查', write: '修改', mixed: '读写混合',
        restore: '恢复', memory: '项目记忆操作', clarify: '需要澄清' };
    const targets = Array.isArray(intent?.targets) ? intent.targets.slice(0, 16).map((target) =>
        `${String(target.target || '未绑定对象').slice(0, 160)} · ${String(target.field || '').slice(0, 80)} = ${JSON.stringify(target.equals)}`).join('；') : '';
    return `任务理解建议：${kinds[intent?.kind] || '未分类'}${targets ? ` · 目标 ${targets}` : ''}。这是校验提案，不代表批准或完成；仍以原始要求、逐次审批和工具回执为准。`;
}

Editor.Panel.extend({
    style: `
        :host { display: block; height: 100%; color: #e7e9ec; background: #242629; font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        .root { height: 100%; min-height: 0; display: flex; flex-direction: column; }
        .top { padding: 12px; border-bottom: 1px solid #3d4045; }
        .brand { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .brand-actions { display: flex; align-items: center; gap: 8px; }
        .brand strong { font-size: 14px; letter-spacing: .2px; }
        .extension-version { color: #969da7; font-size: 10px; font-weight: 400; letter-spacing: 0; vertical-align: middle; }
        .export-log { padding: 3px 7px; font-size: 10px; white-space: nowrap; }
        .connection { color: #a9afb8; font-size: 11px; }
        .connection[data-state="ready"] { color: #76d39b; }
        .clear-chat { padding: 3px 7px; font-size: 10px; white-space: nowrap; }
        .clear-chat.confirming { color: #fff2d4; background: #74552b; border-color: #a47b3e; }
        .project-context { margin: 8px 0 10px; padding: 7px 8px; border: 1px solid #3d4249; border-radius: 5px; background: #202225; color: #c6cbd2; font-size: 10px; line-height: 1.45; }
        .project-context-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px; }
        .project-context-head strong { color: #e7e9ec; font-size: 11px; }
        .context-actions { display: flex; align-items: center; gap: 4px; }
        .context-refresh { padding: 2px 6px; font-size: 10px; }
        .context-copy { padding: 2px 6px; font-size: 10px; }
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
        .message { position: relative; margin: 0 0 12px; padding: 9px 10px; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; }
        .message.user { background: #343941; margin-left: 22px; }
        .message.assistant { background: #2d3034; margin-right: 12px; }
        .message .role { color: #aeb5bf; display: block; padding-right: 50px; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
        .message-body { white-space: normal; line-height: 1.6; overflow-wrap: anywhere; }
        .message-body > :first-child { margin-top: 0; }
        .message-body > :last-child { margin-bottom: 0; }
        .message-body p { margin: 0 0 9px; }
        .message-body h1, .message-body h2, .message-body h3, .message-body h4 { line-height: 1.35; margin: 12px 0 6px; }
        .message-body h1 { font-size: 17px; } .message-body h2 { font-size: 15px; } .message-body h3, .message-body h4 { font-size: 13px; }
        .message-body ul, .message-body ol { margin: 4px 0 10px; padding-left: 22px; }
        .message-body li { padding: 1px 0; }
        .message-body blockquote { margin: 6px 0 10px; padding: 3px 10px; border-left: 3px solid #65758a; color: #c0c6ce; }
        .message-body blockquote p { margin: 2px 0; }
        .message-body code { padding: 1px 4px; border-radius: 3px; background: #202226; color: #d7e5fa; font: 0.92em Consolas, monospace; }
        .code-block { margin: 10px 0 14px; overflow: hidden; border: 1px solid #41464e; border-radius: 8px; background: #1d1f22; }
        .code-language { padding: 6px 10px; border-bottom: 1px solid #383c42; color: #9da6b2; font-size: 10px; text-transform: uppercase; letter-spacing: .45px; }
        .message-body pre { margin: 0; padding: 11px 13px; max-height: 360px; overflow: auto; white-space: pre; }
        .message-body pre code { padding: 0; background: transparent; }
        .message-body a { color: #8dbdff; }
        .message-body hr { border: 0; border-top: 1px solid #4a4e55; margin: 10px 0; }
        .markdown-table-wrap { max-width: 100%; overflow: auto; margin: 6px 0 10px; }
        .message-body table { border-collapse: collapse; table-layout: fixed; width: 100%; font-size: 11px; }
        .message-body th, .message-body td { padding: 5px 7px; border: 1px solid #4b5058; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
        .message-body th { background: #373b41; color: #eef1f5; }
        .message-body td { color: #d0d4da; }
        .activity { position: relative; min-height: 23px; padding: 3px 52px 3px 2px; color: #aab1bb; font-size: 11px; margin: 4px 2px 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .screenshot-card { position: relative; display: table; max-width: 100%; }
        .runtime-screenshot { display: block; max-width: 100%; max-height: 420px; object-fit: contain; margin: 4px 2px 12px; border: 1px solid #4a5058; border-radius: 4px; background: #17181a; }
        .plan-card, .run-card { position: relative; }
        .plan-card { margin: 0 0 12px; padding: 10px; border: 1px solid #4a5058; border-radius: 6px; background: #282c31; }
        .plan-card h3 { margin: 0 0 6px; padding-right: 50px; font-size: 13px; }
        .plan-summary, .plan-status { color: #b9c0ca; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
        .plan-steps { padding-left: 22px; }
        .plan-steps li { padding: 4px 0; }
        .plan-detail { color: #aeb5bf; font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 4px; }
        .plan-status { margin: 8px 0; color: #d4d8de; font-size: 11px; }
        .plan-action { background: #2867bc; border-color: #3979cf; }
        .run-card { margin: 0 0 10px; padding: 9px; border: 1px solid #57504a; border-radius: 6px; background: #302d29; }
        .task-review { margin-top: 8px; padding: 7px; border: 1px solid #514c44; border-radius: 4px; background: #292824; }
        .task-review h5 { margin: 0 0 5px; font-size: 11px; color: #e2d4bb; }
        .run-card h4 { margin: 0 0 5px; padding-right: 50px; font-size: 12px; }
        .run-meta, .run-effects { color: #c2c0ba; font-size: 10px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
        .run-recover { margin: 5px 5px 0 0; padding: 3px 6px; font-size: 10px; }
        .run-receipt { max-height: 180px; overflow: auto; color: #c2c0ba; font: 10px Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
        .tool-receipt { margin-top: 5px; font-size: 10px; }
        .tool-receipt summary { color: #9fc5ff; cursor: pointer; }
        .tool-receipt pre { max-height: 220px; overflow: auto; margin: 5px 0 0; padding: 7px; border: 1px solid #454a52; border-radius: 4px; background: #202226; color: #cdd2da; white-space: pre-wrap; overflow-wrap: anywhere; }
        .copy-button { position: absolute; z-index: 3; top: 6px; right: 7px; padding: 2px 6px; font-size: 10px; line-height: 1.25; opacity: .82; }
        .copy-button:hover { opacity: 1; }
        .diff-details { margin-top: 5px; font-size: 10px; }
        .diff-details summary { color: #9fc5ff; cursor: pointer; }
        .diff-details pre { max-height: 180px; overflow: auto; color: #cdd2da; white-space: pre-wrap; overflow-wrap: anywhere; }
        .approval { position: relative; display: none; padding: 10px 12px; border-top: 1px solid #615438; background: #312c22; }
        .approval.visible { display: block; }
        .approval-title { padding-right: 50px; color: #f2d084; font-weight: 600; margin-bottom: 5px; }
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

        /* Assistant-style workspace: keep the conversation dominant and move
           mode/model controls next to the prompt where they affect the next run. */
        .top { flex: 0 0 auto; padding: 9px 14px 7px; border-bottom: 1px solid #383b40; background: #25272a; }
        .brand { margin: 0; min-height: 28px; }
        .brand strong { display: flex; align-items: baseline; gap: 7px; font-size: 13px; }
        .brand-actions { gap: 6px; }
        .side-toggle { padding: 3px 7px; color: #b9c0ca; background: transparent; border-color: #41464e; font-size: 10px; white-space: nowrap; }
        .connection { max-width: 35%; overflow: hidden; padding: 3px 8px; border-radius: 12px; background: #303338; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
        .connection[data-state="ready"] { background: #23382d; }
        .project-context { margin: 7px 0 0; padding: 0; border: 0; background: transparent; color: #b9bec7; }
        .project-context > summary { display: flex; align-items: center; gap: 8px; min-height: 26px; cursor: pointer; list-style: none; }
        .project-context > summary::-webkit-details-marker { display: none; }
        .project-context > summary::before { content: '›'; color: #8e98a5; font-size: 16px; transform: rotate(0); transition: transform .12s; }
        .project-context[open] > summary::before { transform: rotate(90deg); }
        .context-project { min-width: 0; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e0e3e8; font-size: 11px; }
        .context-scene { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #969da7; font-size: 10px; }
        .context-label { margin-left: auto; color: #8e98a5; font-size: 10px; white-space: nowrap; }
        .context-expanded { margin: 2px 0 4px 17px; padding: 7px 9px; border-left: 1px solid #484d55; background: #202225; }
        .project-context-head { margin-bottom: 5px; }
        .project-context-head strong { font-size: 10px; }
        .context-line { padding: 2px 0; }
        .connection-settings { margin-top: 4px; color: #a9afb8; font-size: 10px; }
        .connection-settings > summary { display: inline-block; padding: 3px 1px; cursor: pointer; color: #a9afb8; }
        .connection-settings[open] { padding-bottom: 4px; }
        .model-row { margin-top: 4px; }
        .key { padding: 6px 8px; }
        .credential-row { margin-top: 5px; }
        .modebar { flex: 0 0 auto; gap: 3px; margin: 0 0 6px; }
        .mode { flex: 0 0 auto; min-width: 56px; padding: 4px 10px; border-radius: 14px; font-size: 10px; }
        .mode.active { color: #f4f7fb; background: #3b4149; border-color: #58616d; }
        .mode-note { align-self: center; min-height: 0; margin: 0 0 6px 8px; color: #9299a3; font-size: 10px; }
        .messages { width: 100%; max-width: 900px; align-self: center; padding: 24px 32px; }
        .empty { max-width: 600px; margin: auto; padding: 14vh 12px 8vh; text-align: center; font-size: 14px; }
        .message { position: relative; max-width: 100%; margin-bottom: 24px; padding: 0; background: transparent; }
        .message.user { width: fit-content; max-width: min(74%, 720px); margin-left: auto; padding: 10px 14px; border: 1px solid #41464e; border-radius: 14px 14px 4px 14px; background: #343940; }
        .message.assistant { width: 100%; max-width: 820px; margin-right: auto; padding: 2px 0 8px; border: 0; border-radius: 0; background: transparent !important; box-shadow: none; }
        .message-header { display: flex; min-height: 24px; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 5px; }
        .message .role { padding: 0; color: #aeb6c1; font-size: 11px; text-transform: none; letter-spacing: 0; }
        .message.assistant .role { color: #aeb6c1; font-weight: 600; }
        .message.user .message-header { display: none; }
        .message.assistant .copy-button { position: static; flex: 0 0 auto; opacity: 0; border-color: transparent; background: transparent; color: #aeb5bf; }
        .message.assistant:hover .copy-button, .message.assistant .copy-button:focus { opacity: .8; }
        .message.assistant .copy-button:hover { background: #34383e; color: #fff; }
        .message-body { max-width: 76ch; font-size: 13px; line-height: 1.68; color: #e1e4e8; }
        .message.user .message-body { max-width: none; }
        .message-body p { margin-bottom: 11px; }
        .message-body h1, .message-body h2, .message-body h3, .message-body h4 { letter-spacing: -.15px; }
        .message-body h1 { margin-top: 20px; padding-bottom: 7px; border-bottom: 1px solid #3b4047; font-size: 19px; }
        .message-body h2 { margin-top: 18px; font-size: 16px; }
        .message-body h3, .message-body h4 { margin-top: 14px; font-size: 13px; }
        .message-body ul, .message-body ol { margin-top: 6px; margin-bottom: 12px; padding-left: 24px; }
        .message-body li { padding: 2px 0; }
        .message-body blockquote { margin: 10px 0 14px; padding: 5px 13px; border-left-width: 2px; border-radius: 0 5px 5px 0; background: #292d32; color: #c4cad2; }
        .message-body code { padding: 2px 5px; border-radius: 4px; background: #30343a; color: #d7e5fa; }
        .message-body a { text-decoration: none; }
        .message-body a:hover { text-decoration: underline; }
        .message-body table { table-layout: auto; min-width: 100%; width: max-content; }
        .message-body th, .message-body td { padding: 7px 9px; }
        .copyable.message.assistant > .copy-button { display: none; }
        .activity { width: 100%; max-width: 760px; margin: 3px auto 8px; padding: 7px 10px 7px 22px; border: 1px solid #383d44; border-left: 2px solid #59616c; border-radius: 7px; background: #26292d; color: #b8c0ca; font-size: 10px; }
        .activity::before { content: ''; position: absolute; top: 11px; left: 7px; width: 5px; height: 5px; border-radius: 50%; background: #7d8998; }
        .plan-card, .run-card { width: 100%; max-width: 800px; margin: 10px auto 16px; padding: 13px 15px; border-color: #444a53; border-radius: 10px; background: #292c31; }
        .plan-card { border-left: 3px solid #6da9ff; }
        .plan-card[data-status="completed"] { border-left-color: #66bd84; }
        .plan-card[data-status="needs-review"], .plan-card[data-status="needs-regeneration"] { border-left-color: #d7a65b; }
        .plan-card[data-status="paused"] { border-left-color: #db785f; }
        .plan-card h3 { font-size: 14px; }
        .plan-summary { margin: 3px 0 8px; font-size: 11px; }
        .plan-steps { margin-top: 7px; padding-left: 20px; }
        .plan-steps li { padding: 6px 0; border-top: 1px solid #3c4148; }
        .plan-detail { margin-top: 5px; color: #9fa7b2; }
        .plan-status { padding: 8px 0; border-top: 1px solid #3c4148; }
        .plan-action { min-width: 116px; padding: 7px 12px; border-radius: 5px; }
        .run-card { background: #292b2e; }
        .approval { flex: 0 0 auto; border-top: 1px solid #836938; }
        .composer { flex: 0 0 auto; width: 100%; max-width: 920px; align-self: center; padding: 8px 14px 12px; border: 0; }
        .composer-box { padding: 9px 10px 7px; border: 1px solid #50555e; border-radius: 11px; background: #202225; box-shadow: 0 4px 18px rgba(0,0,0,.16); }
        .composer textarea { min-height: 58px; max-height: 180px; border: 0; background: transparent; font: inherit; }
        .composer textarea:focus { border: 0; }
        .composer-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
        .composer-foot { flex: 1 1 240px; margin: 0; }
        .composer-foot .hint { padding-left: 2px; }
        .send { min-width: 64px; padding: 6px 11px; border-radius: 7px; }
        .workspace { position: relative; flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(190px, 230px) minmax(0, 1fr) minmax(220px, 270px); grid-template-rows: minmax(0, 1fr); }
        .side-panel { min-width: 0; min-height: 0; overflow: auto; padding: 13px 12px; background: #222427; color: #c8cdd4; }
        .task-sidebar { border-right: 1px solid #383b40; }
        .review-sidebar { border-left: 1px solid #383b40; }
        .side-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 12px; color: #e4e7eb; font-size: 11px; font-weight: 650; }
        .side-heading button { padding: 2px 6px; color: #aeb5bf; background: transparent; border-color: transparent; font-size: 10px; }
        .side-section { margin: 0 0 16px; }
        .side-section h4 { margin: 0 0 7px; color: #929aa5; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .35px; }
        .side-summary, .side-list { margin: 0; color: #c8cdd4; font-size: 11px; line-height: 1.55; overflow-wrap: anywhere; }
        .side-muted { color: #858d98; }
        .side-list { padding-left: 17px; }
        .side-list li { margin: 0 0 6px; }
        .side-status { display: inline-flex; align-items: center; gap: 5px; margin-top: 7px; padding: 3px 7px; border: 1px solid #41464e; border-radius: 10px; color: #b9c2cd; font-size: 10px; }
        .side-status[data-state="running"] { color: #9fc5ff; border-color: #405b7c; }
        .side-status[data-state="completed"] { color: #8bd1a3; border-color: #365b43; }
        .side-status[data-state="failed"] { color: #ef9c8c; border-color: #71443b; }
        .workspace .messages { width: 100%; height: auto; max-width: 1120px; min-width: 0; min-height: 0; align-self: stretch; justify-self: center; }
        .review-sidebar .project-context { display: block; margin: 0; padding: 0; border: 0; background: transparent; }
        .review-sidebar .project-context > summary { min-height: 22px; margin-bottom: 6px; cursor: default; }
        .review-sidebar .context-expanded { margin: 0; padding: 0; border: 0; background: transparent; }
        .review-sidebar .project-context-head { align-items: flex-start; }
        .review-sidebar .context-actions { flex-shrink: 0; }
        .review-sidebar .context-line { margin: 0 0 7px; color: #c2c8d0; }
        .review-sidebar .context-muted { color: #929aa5; }
        .review-detail { max-height: 220px; overflow: auto; margin: 0; padding: 8px; border: 1px solid #3b4047; border-radius: 6px; background: #1d1f22; color: #c8cdd4; font: 10px/1.5 Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
        .workspace.left-collapsed { grid-template-columns: minmax(0, 1fr) minmax(220px, 270px); }
        .workspace.left-collapsed .task-sidebar { display: none; }
        .workspace.right-collapsed { grid-template-columns: minmax(190px, 230px) minmax(0, 1fr); }
        .workspace.right-collapsed .review-sidebar { display: none; }
        .workspace.left-collapsed.right-collapsed { grid-template-columns: minmax(0, 1fr); }
        .workspace.left-collapsed.right-collapsed .messages { max-width: 1120px; }
        .restore-sidebar { display: none; position: absolute; z-index: 6; top: 12px; align-items: center; justify-content: center; padding: 8px 7px; border: 1px solid #4a515b; border-radius: 7px; background: #30343a; color: #d5dbe3; font-size: 10px; writing-mode: vertical-rl; box-shadow: 0 3px 12px rgba(0,0,0,.22); }
        .restore-sidebar:hover { background: #3e444c; }
        .restore-left { left: 5px; }
        .restore-right { right: 5px; }
        .workspace.left-collapsed .restore-left, .workspace.right-collapsed .restore-right { display: inline-flex; }
        @media (max-width: 520px) {
            .brand-actions { gap: 3px; }
            .export-log, .clear-chat { padding: 3px 5px; font-size: 9px; }
            .connection { max-width: 90px; }
            .context-project { max-width: 55%; }
            .context-scene { display: none; }
            .composer-foot { flex-basis: 100%; }
            .messages { padding: 14px 12px; }
            .message { max-width: 100%; }
            .message.assistant { max-width: 100%; }
            .message.user { max-width: 88%; }
            .message-body { font-size: 12px; }
        }
        @media (max-width: 1080px) {
            .workspace { display: block; position: relative; }
            .workspace .messages { height: 100%; max-width: 100%; }
            .workspace .side-panel { display: none; position: absolute; z-index: 5; top: 0; bottom: 0; width: min(310px, 86vw); box-shadow: 0 8px 24px rgba(0,0,0,.35); }
            .workspace .task-sidebar { left: 0; border-right: 1px solid #484d55; }
            .workspace .review-sidebar { right: 0; border-left: 1px solid #484d55; }
            .workspace.show-left .task-sidebar, .workspace.show-right .review-sidebar { display: block; }
            .workspace:not(.show-left) .restore-left, .workspace:not(.show-right) .restore-right { display: inline-flex; writing-mode: horizontal-tb; }
            .workspace.left-collapsed, .workspace.right-collapsed, .workspace.left-collapsed.right-collapsed { display: block; }
        }
    `,

    template: `
        <div class="root">
            <header class="top">
                <div class="brand"><strong>CocosAgent <span class="extension-version" id="extension-version">v…</span></strong><div class="brand-actions"><button class="side-toggle" id="show-left" title="显示或收起任务栏">任务</button><button class="side-toggle" id="show-right" title="显示或收起上下文与审阅栏">审阅</button><span class="connection" id="connection">未连接</span><button class="export-log" id="export-log">导出日志</button><button class="clear-chat" id="clear-chat" title="清除当前会话的聊天文本">清空聊天</button></div></div>
                <details class="connection-settings" id="connection-settings">
                    <summary>模型连接与凭据</summary>
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
                </details>
            </header>
            <div class="workspace" id="workspace">
                <aside class="side-panel task-sidebar" aria-label="任务与计划">
                    <div class="side-heading"><span>任务</span><button id="hide-left" title="收起任务栏" aria-label="收起任务栏">收起</button></div>
                    <section class="side-section"><h4>当前任务</h4><p class="side-summary side-muted" id="task-summary">还没有进行中的任务。</p><span class="side-status" id="task-status" data-state="idle">空闲</span></section>
                    <section class="side-section"><h4>计划</h4><p class="side-summary side-muted" id="task-plan">生成计划后会显示在这里。</p></section>
                    <section class="side-section"><h4>执行清单</h4><ul class="side-list side-muted" id="task-checklist"><li>暂无执行项</li></ul></section>
                </aside>
                <section class="messages" id="messages" aria-live="polite">
                    <div class="empty" id="empty">选择模式并连接 DeepSeek，然后直接用自然语言描述你要了解或完成的工作。</div>
                </section>
                <aside class="side-panel review-sidebar" aria-label="工程上下文与审阅">
                    <div class="side-heading"><span>上下文与审阅</span><button id="hide-right" title="收起审阅栏" aria-label="收起审阅栏">收起</button></div>
                    <section class="side-section">
                        <h4>Creator 工程</h4>
                        <details class="project-context" id="project-context" open>
                            <summary><span class="context-project" id="context-project">正在读取工程…</span><span class="context-scene" id="context-scene">场景：读取中…</span><span class="context-label">工程上下文</span></summary>
                            <div class="context-expanded">
                                <div class="project-context-head"><strong class="context-project" id="context-project-detail">当前 Creator 项目</strong><span class="context-actions"><button class="context-copy" id="context-copy">复制</button><button class="context-refresh" id="context-refresh">刷新</button></span></div>
                                <div class="context-line" id="context-selection">选中对象：读取中…</div>
                                <div class="context-line context-muted" id="context-conventions">项目约定：读取中…</div>
                            </div>
                        </details>
                    </section>
                    <section class="side-section"><h4>最近工具结果</h4><p class="side-summary side-muted" id="review-latest">尚无工具回执。</p></section>
                    <section class="side-section"><h4>差异 / 操作摘要</h4><pre class="review-detail" id="review-detail">工具回执和可用差异会显示在这里。</pre></section>
                </aside>
                <button class="restore-sidebar restore-left" id="restore-left" title="重新展开任务栏" aria-label="重新展开任务栏">展开任务</button>
                <button class="restore-sidebar restore-right" id="restore-right" title="重新展开上下文与审阅栏" aria-label="重新展开上下文与审阅栏">展开审阅</button>
            </div>
            <section class="approval" id="approval">
                <div class="approval-title">Agent 请求执行一项编辑器操作</div>
                <div class="approval-tool" id="approval-tool"></div>
                <pre class="approval-args" id="approval-args"></pre>
                <div class="approval-actions"><button id="reject">拒绝</button><button id="approve" class="approve">批准并执行</button></div>
            </section>
            <footer class="composer">
                <div class="composer-box">
                    <textarea id="prompt" maxlength="8000" placeholder="向 CocosAgent 提问…"></textarea>
                    <div class="composer-controls">
                        <div class="modebar" role="tablist" aria-label="Agent 模式">
                            <button class="mode active" id="mode-ask" data-mode="Ask" role="tab">Ask</button>
                            <button class="mode" id="mode-plan" data-mode="Plan" role="tab">Plan</button>
                            <button class="mode" id="mode-agent" data-mode="Agent" role="tab">Agent</button>
                        </div>
                        <div class="mode-note" id="mode-note">只读询问工程、场景和资源。</div>
                        <div class="composer-foot"><span class="hint">Enter 发送 · Shift+Enter 换行</span><div><button id="cancel-run" hidden>停止任务</button> <button class="send" id="send">发送</button></div></div>
                    </div>
                </div>
            </footer>
        </div>
    `,

    $: {
        connection: '#connection', extensionVersion: '#extension-version', exportLog: '#export-log', clearChat: '#clear-chat', apiKey: '#api-key', model: '#model', connect: '#connect', rememberKey: '#remember-key', forgetKey: '#forget-key',
        workspace: '#workspace', hideLeft: '#hide-left', hideRight: '#hide-right', showLeft: '#show-left', showRight: '#show-right', restoreLeft: '#restore-left', restoreRight: '#restore-right',
        taskSummary: '#task-summary', taskStatus: '#task-status', taskPlan: '#task-plan', taskChecklist: '#task-checklist', reviewLatest: '#review-latest', reviewDetail: '#review-detail',
        projectContext: '#project-context', connectionSettings: '#connection-settings', contextCopy: '#context-copy', contextRefresh: '#context-refresh', contextProject: '#context-project', contextProjectDetail: '#context-project-detail', contextScene: '#context-scene',
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
        this._latestPlan = null;
        this._latestChecklist = [];
        this._clearChatArmed = false;
        this._clearChatTimer = null;
        this._copyRequests = new Map();
        this._exportRequestId = null;
        this._pendingSupportLog = null;
        this._waitingForExportData = false;
        this._conversationId = localStorage.getItem('cocos-agent-assistant-conversation') || makeId();
        localStorage.setItem('cocos-agent-assistant-conversation', this._conversationId);
        this.$clearChat.disabled = true;
        this._modeButtons = [this.$modeAsk, this.$modePlan, this.$modeAgent];
        this._modeButtons.forEach((button) => button.addEventListener('click', () => this.selectMode(button.dataset.mode)));
        this.$connect.addEventListener('click', () => this.startRuntime());
        this.$forgetKey.addEventListener('click', () => {
            this.$forgetKey.disabled = true;
            Editor.Ipc.sendToMain('cocos-agent-bridge:assistantCredentialForget');
        });
        this.$send.addEventListener('click', () => this.sendPrompt());
        this.$clearChat.addEventListener('click', () => this.clearChat());
        this.$exportLog.addEventListener('click', () => this.exportLog());
        this.$cancelRun.addEventListener('click', () => this.cancelRun());
        this.$contextCopy.addEventListener('click', () => this.requestClipboard([
            this.$contextProject.textContent, this.$contextScene.textContent,
            this.$contextSelection.textContent, this.$contextConventions.textContent,
        ].join('\n'), this.$contextCopy));
        this.$contextRefresh.addEventListener('click', () => this.refreshProjectContext());
        this.$hideLeft.addEventListener('click', () => this.hideSidebar('left'));
        this.$hideRight.addEventListener('click', () => this.hideSidebar('right'));
        this.$showLeft.addEventListener('click', () => this.toggleSidebar('left'));
        this.$showRight.addEventListener('click', () => this.toggleSidebar('right'));
        this.$restoreLeft.addEventListener('click', () => this.openSidebar('left'));
        this.$restoreRight.addEventListener('click', () => this.openSidebar('right'));
        this.$prompt.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendPrompt(); }
        });
        this.$approve.addEventListener('click', () => this.answerApproval(true));
        this.$reject.addEventListener('click', () => this.answerApproval(false));
        Editor.Ipc.sendToMain('cocos-agent-bridge:assistantState');
        Editor.Ipc.sendToMain('cocos-agent-bridge:assistantVersion');
        this.refreshProjectContext();
    },

    messages: {
        'assistant-extension-version'(_event, payload) {
            if (typeof payload?.version === 'string') this.$extensionVersion.textContent = `v${payload.version}`;
        },
        'assistant-copy-result'(_event, payload) {
            const request = this._copyRequests.get(payload?.requestId);
            if (!request) return;
            this._copyRequests.delete(payload.requestId);
            request.button.disabled = false;
            request.button.textContent = payload.success ? '已复制' : '复制失败';
            setTimeout(() => {
                if (request.button && request.button.parentNode) request.button.textContent = '复制';
            }, 1400);
        },
        'assistant-log-export-result'(_event, payload) {
            if (!payload || payload.requestId !== this._exportRequestId) return;
            this._exportRequestId = null;
            this._pendingSupportLog = null;
            this.$exportLog.disabled = false;
            if (payload.canceled) { this.$exportLog.textContent = '导出日志'; return; }
            this.$exportLog.textContent = payload.success ? '导出完成' : '导出失败';
            if (payload.success) this.addActivity(`日志已导出：${payload.filePath}`);
            else this.addActivity(`日志导出失败：${payload.error || '未知错误'}`);
            setTimeout(() => { this.$exportLog.textContent = '导出日志'; }, 1800);
        },
        'assistant-runtime-ready'(_event, payload) {
            this.connectRuntime(payload);
        },
        'assistant-runtime-state'(_event, payload) {
            if (payload && payload.ready) this.connectRuntime(payload);
            else if (payload && payload.connecting) {
                this.$connect.disabled = true;
                this.setConnection('正在读取本机保存的凭据…', '');
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
        if (state === 'error' && this.$connectionSettings) this.$connectionSettings.open = true;
    },

    clearChat() {
        if (this._busy || this._pendingApproval || !this._socket || this._socket.readyState !== WebSocket.OPEN) return;
        if (!this._clearChatArmed) {
            this._clearChatArmed = true;
            this.$clearChat.classList.add('confirming');
            this.$clearChat.textContent = '确认清空';
            this.$clearChat.title = '再次点击以清除聊天；计划和操作记录会保留';
            this._clearChatTimer = setTimeout(() => this.resetClearChatConfirmation(), 4000);
            return;
        }
        this.resetClearChatConfirmation();
        this.$clearChat.disabled = true;
        this._clearConversationId = this._conversationId;
        this._socket.send(JSON.stringify({ type: 'conversation.clear', conversationId: this._conversationId }));
    },

    resetClearChatConfirmation() {
        if (this._clearChatTimer) clearTimeout(this._clearChatTimer);
        this._clearChatTimer = null;
        this._clearChatArmed = false;
        this.$clearChat.classList.remove('confirming');
        this.$clearChat.textContent = '清空聊天';
        this.$clearChat.title = '清除当前会话的聊天文本';
    },

    finishClearChat(error) {
        this.$clearChat.disabled = false;
        if (error) {
            this.setConnection(`清空聊天失败：${error}`, 'error');
            return;
        }
        this._conversationId = makeId();
        localStorage.setItem('cocos-agent-assistant-conversation', this._conversationId);
        this._clearConversationId = null;
        this._planCards.clear();
        this._plans.clear();
        this._runCards.clear();
        if (this._usageCards) this._usageCards.clear();
        clearChildren(this.$messages);
        this.$messages.appendChild(this.$empty);
        this.$empty.textContent = '当前聊天已清空。计划、运行记录和操作账本仍保留。';
        this.setConnection(this.$connection.textContent, 'ready');
        setTimeout(() => this.$prompt.focus(), 0);
    },

    addCopyButton(element) {
        if (!element || element.querySelector('.copy-button')) return;
        element.classList.add('copyable');
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.type = 'button';
        button.textContent = '复制';
        button.title = '复制这条信息';
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const text = visibleText(element);
            if (!text) return;
            this.requestClipboard(text, button);
        });
        element.appendChild(button);
    },

    requestClipboard(text, button) {
        const content = safeSupportText(text).slice(0, 256000);
        if (!content || !button) return;
        const requestId = makeId();
        button.disabled = true;
        this._copyRequests.set(requestId, { button });
        Editor.Ipc.sendToMain('cocos-agent-bridge:assistantClipboardWrite', { requestId, text: content });
    },

    requestImageClipboard(imageDataUrl, button) {
        if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/jpeg;base64,')
            || imageDataUrl.length > 2800000 || !button) return;
        const requestId = makeId();
        button.disabled = true;
        this._copyRequests.set(requestId, { button });
        Editor.Ipc.sendToMain('cocos-agent-bridge:assistantClipboardWrite', { requestId, imageDataUrl });
    },

    exportLog() {
        if (this._exportRequestId) return;
        const items = [];
        Array.prototype.slice.call(this.$messages.children).forEach((element) => {
            if (element.classList.contains('empty')) return;
            const type = ['message', 'activity', 'plan-card', 'run-card', 'screenshot-card'].find((name) => element.classList.contains(name))
                || (element.tagName === 'IMG' ? 'screenshot' : 'info');
            const screenshot = type === 'screenshot' || type === 'screenshot-card';
            const image = screenshot ? element.querySelector('img') || element : null;
            const text = screenshot ? `[截图] ${image.alt || 'Creator 运行画布截图'}（图像未写入日志）` : visibleText(element);
            if (text) items.push({ type, text });
        });
        const data = {
            format: 'cocos-agent-support-log', formatVersion: 1,
            exportedAt: new Date().toISOString(), creatorVersion: '2.4.15',
            extensionVersion: this.$extensionVersion.textContent.replace(/^v/, ''),
            projectContext: {
                project: safeSupportText(this.$contextProject.textContent),
                scene: safeSupportText(this.$contextScene.textContent),
                selection: safeSupportText(this.$contextSelection.textContent),
                conventions: safeSupportText(this.$contextConventions.textContent),
            },
            mode: this._mode, conversationId: this._conversationId, timeline: items,
        };
        this._pendingSupportLog = data;
        this._exportRequestId = makeId();
        this.$exportLog.disabled = true;
        this.$exportLog.textContent = '整理日志…';
        if (this._socket && this._socket.readyState === WebSocket.OPEN) {
            this._waitingForExportData = true;
            this._socket.send(JSON.stringify({ type: 'conversation.export', conversationId: this._conversationId,
                requestId: this._exportRequestId }));
        } else this.saveSupportLog({ messages: [], plans: [], runs: [], traces: [] });
    },

    saveSupportLog(agentData) {
        if (!this._pendingSupportLog || !this._exportRequestId) return;
        this._waitingForExportData = false;
        const data = { ...this._pendingSupportLog, agent: agentData };
        const contents = JSON.stringify(data, null, 2);
        if (contents.length > 4000000) {
            this._pendingSupportLog = null;
            this._exportRequestId = null;
            this.$exportLog.disabled = false;
            this.$exportLog.textContent = '导出日志';
            this.addActivity('日志导出失败：当前日志超过 4 MB。');
            return;
        }
        this.$exportLog.textContent = '选择保存位置…';
        Editor.Ipc.sendToMain('cocos-agent-bridge:assistantLogExport', {
            requestId: this._exportRequestId, contents,
        });
        this._pendingSupportLog = null;
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
            this.$clearChat.disabled = this._busy;
            socket.send(JSON.stringify({ type: 'resume', conversationId: this._conversationId }));
        });
        socket.addEventListener('message', (event) => this.receiveMessage(event.data));
        socket.addEventListener('close', () => {
            if (this._socket === socket) {
                this.setConnection('连接已关闭', '');
                this.$clearChat.disabled = true;
                this._clearConversationId = null;
                if (this._waitingForExportData) {
                    this._waitingForExportData = false;
                    this._pendingSupportLog = null;
                    this._exportRequestId = null;
                    this.$exportLog.disabled = false;
                    this.$exportLog.textContent = '导出日志';
                }
                if (this._busy) this.finishRun('连接中断；继续操作前请先查询操作回执');
            }
            this.$connect.disabled = false;
        });
        socket.addEventListener('error', () => {
            this.setConnection('无法连接本地 Agent 服务', 'error');
            this.$clearChat.disabled = true;
            this._clearConversationId = null;
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
        this.$clearChat.disabled = true;
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
        this.updateTaskSidebar(text, `${this._mode} · 正在处理`, 'running');
        this._runActivity = this.addActivity(`${this._mode} · 正在刷新工程上下文…`);
        this.refreshProjectContext((error) => {
            if (this._requestId !== requestId) return;
            if (error) { this.finishRun(`工程上下文读取失败：${error.message || error}`, 'failed'); return; }
            if (this._cancelRequested) { this.finishRun('已在发送任务前取消；Agent 未收到请求。', 'cancelled'); return; }
            if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
                this.finishRun('本地 Agent 连接已断开；请先重新连接。', 'failed'); return;
            }
            if (this._runActivity) {
                this._runActivity.textContent = `${this._mode} · 正在处理…`;
                this.addCopyButton(this._runActivity);
            }
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
            this.$contextProjectDetail.textContent = `${projectName} · Creator ${context.creatorVersion || '未知版本'}`;
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
        if (message.type === 'conversation.cleared') {
            if (message.conversationId !== this._clearConversationId) return;
            this.finishClearChat(message.error);
            return;
        }
        if (message.type === 'conversation.exported') {
            if (message.requestId !== this._exportRequestId || message.conversationId !== this._conversationId) return;
            this._waitingForExportData = false;
            if (!this._pendingSupportLog) return;
            this.saveSupportLog({ messages: message.messages || [], plans: message.plans || [],
                runs: message.runs || [], traces: message.traces || [] });
            return;
        }
        if (message.type === 'connected') return;
        if (message.requestId && message.requestId !== this._requestId) return;
        if (message.type === 'run.started') { this.addActivity(`${message.mode} · 已开始`); return; }
        if (message.type === 'task.intent') { this.addActivity(describeTaskIntent(message)); return; }
        if (message.type === 'model.usage') {
            this.renderModelUsage(message.modelUsage, [message.request], message.requestId || message.runId, true);
            return;
        }
        if (message.type === 'todo.updated') {
            this.renderExecutionChecklist(message.items, message.requestId || message.runId, true);
            return;
        }
        if (message.type === 'goal.evaluated') {
            this.renderGoalEvaluation(message);
            return;
        }
        if (message.type === 'run.finished') {
            this.renderExecutionChecklist(message.executionChecklist, message.requestId || message.runId, true);
            return;
        }
        if (message.type === 'run.cancelling') { this.addActivity(message.message || '正在安全停止…'); return; }
        if (message.type === 'run.cancel.rejected') { this.addActivity(`无法停止：${message.reason || '任务已结束'}`); return; }
        if (message.type === 'run.persistence-error') {
            this.addActivity('本地会话状态写入失败，Agent 已停止后续调度；请核对上方已有回执和 Creator 操作记录。');
            return;
        }
        if (message.type === 'run.recovery.result') { this.renderRecoveryResult(message); return; }
        if (message.type === 'model.thinking') { this.addActivity('正在联系模型 Provider…'); return; }
        if (message.type === 'context.compacted') {
            const report = message.report || {};
            const identities = Array.isArray(report.operationIdentities) ? report.operationIdentities.length : 0;
            const pending = Array.isArray(report.outstandingAcceptance) ? report.outstandingAcceptance.length : 0;
            const compactedResults = report.compactedToolResults || 0;
            const summary = report.dialogueSummarySource === 'provider' ? '已保留模型整理的历史约束' : '使用确定性历史摘要';
            this.addActivity(`上下文已压缩：${summary}；${report.summarizedToolCalls || 0} 次旧工具调用已建立回执索引，另缩短 ${compactedResults} 条只读回执；保留 ${identities} 个操作身份和 ${pending} 项待验收/恢复状态。`);
            return;
        }
        if (message.type === 'context.budget-exceeded') {
            const report = message.report || {};
            this.addActivity(`上下文仍超出预算（估算 ${report.estimatedTokens || '?'} / ${report.maxEstimatedTokens || '?'} tokens）；Agent 已停止后续模型调用。`);
            return;
        }
        if (message.type === 'model.failed') { this.addActivity(`模型 Provider 请求失败：${message.message || '未知错误'}`); return; }
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
                if (result.session) {
                    const sessionId = String(result.session.id || '').slice(0, 8);
                    lines.push(`预览会话：${sessionId} · 第 ${result.session.observationIndex || 1} 次观察 · ${result.session.reused ? '复用页面' : '首次打开'}`);
                    if (result.session.visible) lines.push('在 Agent 专用预览窗口中操作，再观察可读取操作后的状态。');
                }
                if (result.runtime.pageErrorCount) lines.push(`当前页面累计错误：${result.runtime.pageErrorCount}（刷新前保留）`);
                if (result.targetNode) lines.push(`目标节点：${result.targetNode.path} · ${result.targetNode.active ? '启用' : '未启用'}`);
                if (result.screenshot) lines.push(`画面：${result.screenshot.available ? '已截取' : '不可用'}`);
                summary = `${label}：${message.toolName}\n${lines.join('\n')}`;
            } else summary = `${label}：${message.toolName}\n${JSON.stringify(details).slice(0, 900)}`;
            const activity = this.addActivity(summary);
            const diff = result.expectedDiff || result.script?.expectedDiff;
            if (diff !== undefined) this.appendDiffDetails(activity, diff);
            this.$reviewLatest.textContent = `${label} · ${message.toolName}${result.operationId ? ` · operation ${result.operationId}` : ''}`;
            this.$reviewDetail.textContent = diff !== undefined
                ? JSON.stringify({ toolName: message.toolName, operationId: result.operationId || null, diff }, null, 2).slice(0, 8000)
                : JSON.stringify({ toolName: message.toolName, operationId: result.operationId || null,
                    summary: summary.slice(0, 1800) }, null, 2).slice(0, 8000);
            const receipt = document.createElement('details');
            receipt.className = 'tool-receipt';
            const receiptSummary = document.createElement('summary');
            receiptSummary.textContent = '展开工具回执';
            const receiptBody = document.createElement('pre');
            receiptBody.textContent = JSON.stringify({ toolName: message.toolName, access: message.access,
                arguments: message.arguments, isError: Boolean(message.isError), result: details }, null, 2).slice(0, 12000);
            receipt.appendChild(receiptSummary);
            receipt.appendChild(receiptBody);
            activity.appendChild(receipt);
            if (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/jpeg;base64,')
                && imageDataUrl.length <= 2 * 1024 * 1024 * 4 / 3 + 64) {
                const screenshot = document.createElement('div');
                screenshot.className = 'screenshot-card';
                const image = document.createElement('img');
                image.className = 'runtime-screenshot';
                image.alt = 'Creator 运行画布截图';
                image.src = imageDataUrl;
                screenshot.appendChild(image);
                const copy = document.createElement('button');
                copy.className = 'copy-button';
                copy.type = 'button';
                copy.textContent = '复制图片';
                copy.title = '复制截图到剪贴板';
                copy.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this.requestImageClipboard(image.src, copy);
                });
                screenshot.appendChild(copy);
                this.$messages.appendChild(screenshot);
                this.$messages.scrollTop = this.$messages.scrollHeight;
            }
            return;
        }
        if (message.type === 'approval.required') { this.showApproval(message); return; }
        if (message.type === 'run.rejected') { this.finishRun(message.reason); return; }
        if (message.type === 'run.failed') {
            this.renderModelUsage(message.modelUsage, message.modelUsageRequests, message.requestId);
            this.addMessage('assistant', message.message || '请求失败');
            if (message.planProgress) this.renderPlan(message.planProgress);
            this.finishRun(message.message, 'failed');
            return;
        }
        if (message.type === 'run.result') {
            this.renderModelUsage(message.result && message.result.modelUsage,
                message.result && message.result.modelUsageRequests, message.requestId);
            this.addMessage('assistant', message.result?.finalText || '任务已结束。');
            this.renderExecutionChecklist(message.result?.executionChecklist, message.requestId, true);
            if (message.result?.goalEvaluation) this.renderGoalEvaluation({
                ...message.result.goalEvaluation,
                continuationAttempt: message.result.goalEvaluation.continuationAttempt || 0,
                maxContinuationAttempts: message.result.goalEvaluation.maxContinuationAttempts || 0,
            });
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
        this.addCopyButton(this.$approval);
        this.addActivity('Agent 等待你的操作批准。');
    },

    answerApproval(approved) {
        if (!this._pendingApproval || !this._socket || this._socket.readyState !== WebSocket.OPEN) return;
        this._socket.send(JSON.stringify({ type: 'approval', approvalId: this._pendingApproval, approved }));
        this._pendingApproval = null;
        this.$approval.classList.remove('visible');
        this.addActivity(approved ? '已批准。' : '已拒绝。');
    },

    toggleSidebar(side) {
        const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 1080px)').matches;
        const shownClass = narrow ? `show-${side}` : `${side}-collapsed`;
        const otherShownClass = narrow ? `show-${side === 'left' ? 'right' : 'left'}` : null;
        this.$workspace.classList.toggle(shownClass);
        if (otherShownClass) this.$workspace.classList.remove(otherShownClass);
    },

    openSidebar(side) {
        const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 1080px)').matches;
        if (narrow) {
            this.$workspace.classList.add(`show-${side}`);
            this.$workspace.classList.remove(`show-${side === 'left' ? 'right' : 'left'}`);
        } else {
            this.$workspace.classList.remove(`${side}-collapsed`);
        }
    },

    hideSidebar(side) {
        const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 1080px)').matches;
        this.$workspace.classList.remove(narrow ? `show-${side}` : `${side}-collapsed`);
        if (!narrow) this.$workspace.classList.add(`${side}-collapsed`);
    },

    updateTaskSidebar(task, status, state) {
        if (typeof task === 'string' && task.trim()) {
            this.$taskSummary.textContent = task.trim().slice(0, 280);
            this.$taskSummary.classList.remove('side-muted');
        }
        if (typeof status === 'string') this.$taskStatus.textContent = status;
        if (typeof state === 'string') this.$taskStatus.dataset.state = state;
    },

    finishRun(reason, status = 'stopped') {
        const labels = { completed: '已结束', cancelled: '已取消', 'needs-review': '待核对',
            'awaiting-approval': '等待批准', stopped: '已停止', failed: '失败' };
        const label = labels[status] || '已停止';
        if (this._runActivity) {
            this._runActivity.textContent = `${this._mode} · ${label}`;
            this.addCopyButton(this._runActivity);
        }
        if (reason && status !== 'completed') this.addActivity(`${label}：${reason}`);
        this._runActivity = null;
        this._busy = false;
        const state = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : status === 'needs-review' ? 'failed' : 'idle';
        this.$taskStatus.dataset.state = state;
        this.$taskStatus.textContent = label;
        if (reason) this.$reviewLatest.textContent = `${label} · ${String(reason).slice(0, 160)}`;
        this.$cancelRun.hidden = true;
        this.$cancelRun.disabled = false;
        this.$cancelRun.textContent = '停止任务';
        this._modeButtons.forEach((button) => { button.disabled = false; });
        this.$clearChat.disabled = !this._socket || this._socket.readyState !== WebSocket.OPEN;
        this._requestId = null;
        this._requestSent = false;
        this._cancelRequested = false;
        this.$send.disabled = false;
        this._pendingApproval = null;
        this.$approval.classList.remove('visible');
        for (const plan of this._plans.values()) this.renderPlan(plan);
    },

    renderGoalEvaluation(goal) {
        const outstanding = Array.isArray(goal.outstanding) ? goal.outstanding : [];
        const summary = goal.satisfied === true
            ? `验收目标 ${goal.taskId || ''}：全部条件均有成功工具回执。`
            : `验收目标 ${goal.taskId || ''}：仍有 ${outstanding.length} 项未完成（续跑 ${goal.continuationAttempt || 0}/${goal.maxContinuationAttempts || 0}）。`;
        const details = outstanding.map((item) => `- ${item.id}: ${item.description} · 缺少回执 ${Array.isArray(item.missingTools) ? item.missingTools.join(', ') || '依赖任务' : '未知'}`);
        this.addActivity([summary, ...details].join('\n'));
        this.$reviewLatest.textContent = goal.satisfied === true ? '任务验收条件已满足。'
            : `任务验收未完成 · ${outstanding.length} 项仍需处理。`;
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
        this._latestPlan = plan;
        this.$taskPlan.textContent = `${plan.title || '未命名计划'} · ${plan.steps.length} 步 · ${plan.status || '状态未知'}${Number.isInteger(plan.completedSteps) ? ` · 完成 ${plan.completedSteps}` : ''}`;
        const planSection = this.$taskPlan.closest('.side-section');
        const previousSteps = planSection.querySelector('.sidebar-plan-steps');
        if (previousSteps) previousSteps.remove();
        const sidebarSteps = document.createElement('ol');
        sidebarSteps.className = 'side-list sidebar-plan-steps';
        plan.steps.slice(0, 12).forEach((step, index) => {
            const row = document.createElement('li');
            row.textContent = `${index + 1}. ${step.title || '未命名步骤'}`;
            sidebarSteps.appendChild(row);
        });
        planSection.appendChild(sidebarSteps);
        const card = document.createElement('section');
        card.className = 'plan-card';
        card.dataset.status = plan.status || 'unknown';
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
            const acceptanceLabels = { read: '只读检查', write: '保存、账本和目标读回', restore: '恢复与读回',
                runtime: '目标运行状态与画面', interaction: '交互功能（当前缺少自动验收入口）', memory: '记忆持久化' };
            detail.textContent += `\n业务验收：${acceptanceLabels[step.acceptance?.kind] || '旧计划尚未定义'}`;
            if (step.acceptance?.targets?.length) detail.textContent += `\n最终目标：\n${step.acceptance.targets
                .map((target) => `${target.target} · ${target.field} = ${JSON.stringify(target.equals)}`).join('\n')}`;
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
            'needs-regeneration': '旧计划缺少业务验收条件；请先核对已有操作，再重新生成计划',
            completed: '计划步骤与整项目标验收已通过' };
        status.textContent = labels[plan.status] || '计划状态未知';
        if (plan.businessEvaluation?.satisfied === false) status.textContent += `\n未完成验收：${(plan.businessEvaluation.outstanding || []).map((item) => item.description).join('；')}`;
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
        this.addCopyButton(card);
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
        const header = document.createElement('div');
        header.className = 'message-header';
        const label = document.createElement('span');
        label.className = 'role';
        label.textContent = role === 'user' ? '你' : 'CocosAgent';
        const body = document.createElement('div');
        body.className = 'message-body';
        if (role === 'assistant') renderAssistantMarkdown(body, text);
        else body.textContent = text;
        header.appendChild(label);
        article.appendChild(header);
        article.appendChild(body);
        this.$messages.appendChild(article);
        this.addCopyButton(article);
        if (role === 'assistant') {
            const copyButton = article.querySelector('.copy-button');
            if (copyButton) header.appendChild(copyButton);
        }
        this.$messages.scrollTop = this.$messages.scrollHeight;
    },

    addActivity(text) {
        const item = document.createElement('div');
        item.className = 'activity';
        item.textContent = text;
        this.addCopyButton(item);
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

    renderExecutionChecklist(items, id, live = false, parent = null) {
        if (!Array.isArray(items)) return;
        this._latestChecklist = items.slice();
        clearChildren(this.$taskChecklist);
        for (const item of items) {
            if (!item || typeof item.content !== 'string') continue;
            const row = document.createElement('li');
            const marker = item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '›' : '○';
            row.textContent = `${marker} ${item.content}`;
            this.$taskChecklist.appendChild(row);
        }
        if (!items.length) {
            const row = document.createElement('li');
            row.textContent = '暂无执行项';
            this.$taskChecklist.appendChild(row);
        }
        const key = String(id || 'unknown');
        if (!this._checklistCards) this._checklistCards = new Map();
        let card = this._checklistCards.get(key);
        if (!card && !items.length) return;
        if (!card || !card.parentNode) {
            card = document.createElement('section');
            card.className = 'run-card execution-checklist';
            this._checklistCards.set(key, card);
        }
        clearChildren(card);
        const title = document.createElement('h4');
        title.textContent = live ? '执行清单 · Agent 进度' : '执行清单 · 保留进度';
        card.appendChild(title);
        const note = document.createElement('div');
        note.className = 'run-meta';
        note.textContent = '模型维护的任务进度；不等同于用户批准的变更计划，也不会授予写入权限。';
        card.appendChild(note);
        const list = document.createElement('ul');
        list.className = 'execution-checklist-items';
        for (const item of items) {
            if (!item || typeof item.content !== 'string') continue;
            const row = document.createElement('li');
            const status = item.status === 'completed' ? '已完成' : item.status === 'in_progress' ? '进行中' : '待处理';
            row.textContent = `${status} · ${item.content}`;
            if (item.status === 'completed') row.className = 'completed';
            list.appendChild(row);
        }
        if (!items.length) {
            const empty = document.createElement('li');
            empty.textContent = '当前执行清单为空。';
            list.appendChild(empty);
        }
        card.appendChild(list);
        const target = parent || this.$messages;
        this.addCopyButton(card);
        if (card.parentNode !== target) target.appendChild(card);
        if (live) this.$messages.scrollTop = this.$messages.scrollHeight;
    },

    renderModelUsage(summary, requests, id, live = false, parent = null) {
        if (!summary || !Number.isSafeInteger(summary.requestCount)) return;
        if (!this._usageCards) this._usageCards = new Map();
        const key = String(id || 'unknown');
        let entry = this._usageCards.get(key);
        if (!entry || !entry.card.parentNode) {
            entry = { card: document.createElement('section'), requests: new Map() };
            entry.card.className = 'run-card model-usage';
            this._usageCards.set(key, entry);
        }
        for (const request of (Array.isArray(requests) ? requests : [])) {
            if (request && typeof request.requestId === 'string') entry.requests.set(request.requestId, request);
        }
        const card = entry.card;
        clearChildren(card);
        const title = document.createElement('h4');
        title.textContent = `Token 用量 · ${summary.requestCount} 次模型请求`;
        card.appendChild(title);
        const append = (text) => {
            const row = document.createElement('div');
            row.className = 'run-meta';
            row.textContent = text;
            card.appendChild(row);
        };
        append(`输入 ${usageMetric(summary, 'inputTokens')} · 输出 ${usageMetric(summary, 'outputTokens')} · 合计 ${usageMetric(summary, 'totalTokens')}`);
        append(`输入缓存命中 ${usageMetric(summary, 'cacheHitTokens')} · 未命中 ${usageMetric(summary, 'cacheMissTokens')}`);
        for (const purpose of ['task-understanding', 'main-loop', 'summary']) {
            const group = summary.byPurpose && summary.byPurpose[purpose];
            if (!group || !group.requestCount) continue;
            const label = purpose === 'summary' ? '摘要' : usagePurposeLabel({ purpose });
            append(`${label} · ${group.requestCount} 次 · 输入 ${usageMetric(group, 'inputTokens')} · 输出 ${usageMetric(group, 'outputTokens')} · 合计 ${usageMetric(group, 'totalTokens')}`);
        }
        append('接口实报；未知字段未估算。缓存用量包含在输入内，不重复相加。');
        if (entry.requests.size) {
            const detail = document.createElement('details');
            const heading = document.createElement('summary');
            heading.textContent = '查看每次请求';
            detail.appendChild(heading);
            for (const request of entry.requests.values()) {
                const row = document.createElement('div');
                row.className = 'run-meta';
                const single = { totals: request.usage || {} };
                row.textContent = `${usagePurposeLabel(request)} · ${request.model || '模型'} · ${request.status === 'failed' ? '失败' : '已返回'}${request.errorCode ? ` · ${request.errorCode}` : ''}`
                    + `\n输入 ${usageMetric(single, 'inputTokens')} · 输出 ${usageMetric(single, 'outputTokens')} · 合计 ${usageMetric(single, 'totalTokens')}`
                    + `\n缓存命中 ${usageMetric(single, 'cacheHitTokens')} · 未命中 ${usageMetric(single, 'cacheMissTokens')}`
                    + `\n${request.startedAt || ''} · ${request.durationMs || 0} ms · request ${request.requestId}`;
                detail.appendChild(row);
            }
            card.appendChild(detail);
        }
        this.addCopyButton(card);
        const target = parent || this.$messages;
        if (card.parentNode !== target) target.appendChild(card);
        if (live) this.$messages.scrollTop = this.$messages.scrollHeight;
    },

    renderRecentRun(run) {
        if (!run || typeof run.id !== 'string') return;
        const card = document.createElement('section');
        card.className = 'run-card';
        const title = document.createElement('h4');
        const statusLabels = { completed: run.mode === 'Plan'
            ? (run.reason === 'plan-generated' ? '计划已生成' : '已结束') : '已完成',
            failed: run.mode === 'Plan' ? '计划生成失败' : '失败',
            stopped: run.goalEvaluation?.satisfied === false ? '未完成' : '已停止', 'awaiting-approval': '等待批准',
            'needs-review': '需要核对', interrupted: '服务重启中断', cancelled: '已取消' };
        title.textContent = `${statusLabels[run.status] || run.status || '任务'} · ${(run.task || '').slice(0, 180)}`;
        const restoredState = run.status === 'completed' ? 'completed' : run.status === 'failed' || run.status === 'needs-review' ? 'failed' : 'idle';
        this.updateTaskSidebar(run.task || '', `${run.mode || 'Agent'} · ${statusLabels[run.status] || run.status || '任务'}`, restoredState);
        card.appendChild(title);
        const meta = document.createElement('div');
        meta.className = 'run-meta';
        meta.textContent = `${run.mode || 'Agent'} · ${run.updatedAt || run.startedAt || ''}${run.reason ? ` · ${run.reason}` : ''}`;
        card.appendChild(meta);
        this.renderModelUsage(run.modelUsage, run.modelUsageRequests, run.id, false, card);
        if (run.goalEvaluation) {
            const goal = document.createElement('div');
            goal.className = 'run-meta';
            const outstanding = Array.isArray(run.goalEvaluation.outstanding) ? run.goalEvaluation.outstanding : [];
            goal.textContent = run.goalEvaluation.satisfied
                ? `验收目标 ${run.goalEvaluation.taskId || ''}：已完成。`
                : `验收目标 ${run.goalEvaluation.taskId || ''}：${outstanding.map((item) => `${item.id} 缺少 ${Array.isArray(item.missingTools) ? item.missingTools.join(', ') || '依赖任务' : '回执'}`).join('；') || '未满足'}。`;
            card.appendChild(goal);
        }
        if (run.taskIntent && typeof run.taskIntent === 'object') {
            const intent = document.createElement('div');
            intent.className = 'run-meta';
            intent.textContent = describeTaskIntent(run.taskIntent);
            card.appendChild(intent);
        }
        const receipts = Array.isArray(run.receipts) ? run.receipts : [];
        if (!run.review) receipts.forEach((receipt) => {
            if (receipt.expectedDiff !== undefined) this.appendDiffDetails(card, receipt.expectedDiff);
        });
        if (run.review && typeof run.review === 'object') {
            const review = run.review;
            const section = document.createElement('section');
            section.className = 'task-review';
            const heading = document.createElement('h5');
            heading.textContent = '任务差异审阅';
            section.appendChild(heading);
            const summary = document.createElement('div');
            summary.className = 'run-meta';
            summary.textContent = `状态 ${review.status || run.status} · 代码 ${review.codeChanges?.length || 0} · 场景/Prefab ${review.sceneChanges?.length || 0} · 其他写入 ${review.otherWrites?.length || 0}`;
            section.appendChild(summary);
            const renderChanges = (label, changes) => {
                for (const change of (Array.isArray(changes) ? changes : []).slice(0, 24)) {
                    const row = document.createElement('div');
                    row.className = 'run-meta';
                    const target = change.path || change.sceneTarget?.path || change.sceneName || change.command || '目标未记录';
                    row.textContent = `${label} · ${target} · ${change.status || '已记录'}${change.operationId ? ` · operation ${change.operationId}` : ''}`;
                    section.appendChild(row);
                    if (change.expectedDiff !== undefined) this.appendDiffDetails(section, change.expectedDiff);
                    if (change.beforeSha256 || change.afterSha256) {
                        const hashes = document.createElement('div');
                        hashes.className = 'run-meta';
                        hashes.textContent = `SHA-256 · before ${change.beforeSha256 || '未记录'} · after ${change.afterSha256 || '未记录'}`;
                        section.appendChild(hashes);
                    }
                }
            };
            renderChanges('代码', review.codeChanges);
            renderChanges('场景/Prefab', review.sceneChanges);
            renderChanges('其他写入', review.otherWrites);
            const note = document.createElement('div');
            note.className = 'run-meta';
            note.textContent = review.note || '差异仅按已记录工具回执汇总。';
            section.appendChild(note);
            card.appendChild(section);
        }
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
        if (run.goalEvaluation?.satisfied === false && Array.isArray(run.goalEvaluation.outstanding)) {
            const unmet = document.createElement('div');
            unmet.className = 'run-unmet';
            unmet.style.whiteSpace = 'pre-wrap';
            unmet.textContent = `尚未完成验收：\n${run.goalEvaluation.outstanding.slice(0, 12)
                .map((item) => `• ${String(item.description || item.id || '未完成项').slice(0, 500)}`).join('\n')}`;
            card.appendChild(unmet);
        }
        this.renderExecutionChecklist(run.executionChecklist, run.id, false, card);
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
        this.addCopyButton(card);
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
            if (message.review) {
                const review = document.createElement('div');
                review.className = 'run-meta';
                review.textContent = `恢复状态：${message.review.status || '已读回'}${message.review.recovery?.disposition ? ` · ${message.review.recovery.disposition}` : ''}`;
                previous.appendChild(review);
            }
            const pre = document.createElement('pre');
            pre.className = 'run-receipt';
            pre.textContent = `只读核对结果：${JSON.stringify(message.receipt || { error: message.error }, null, 2).slice(0, 5000)}`;
            previous.appendChild(pre);
        } else this.renderRecentRun(run);
    },
});
