'use strict';

const fs = require('fs');
const path = require('path');

const candidates = [
    path.join(__dirname, 'command-contract.json'),
    path.resolve(__dirname, '../../../tools/cocos-agent-bridge/catalog.schema.json'),
    path.resolve(__dirname, 'assistant-runtime/tools/cocos-agent-bridge/catalog.schema.json'),
];
let contract = null;
for (const filename of candidates) {
    try {
        if (fs.statSync(filename).isFile()) {
            contract = require(filename);
            break;
        }
    } catch (_) {}
}
if (!contract) throw new Error('COCOS_AGENT_COMMAND_CONTRACT_MISSING');
module.exports = contract;
