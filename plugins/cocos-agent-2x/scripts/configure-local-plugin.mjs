#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(pluginRoot, '../..');
const outputPath = path.join(pluginRoot, '.mcp.json');
const mcpDirectory = path.join(repoRoot, 'tools/cocos-agent-bridge/mcp');
const mcpEntry = path.join(mcpDirectory, 'mcp-server.mjs');

function usage() {
    return 'Usage: node plugins/cocos-agent-2x/scripts/configure-local-plugin.mjs [--project <Creator 2.4.15 project>]...';
}

function parseArgs(args) {
    const projects = [];
    for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '--project' && args[index + 1]) projects.push(args[++index]);
        else if (args[index] === '--help') return { help: true, projects: [] };
        else throw new Error(usage());
    }
    if (projects.length === 0) projects.push(path.join(repoRoot, '2.4.15NewProject'));
    if (projects.length > 8) throw new Error('At most 8 Creator projects can be registered.');
    const canonical = projects.map((project) => {
        if (!path.isAbsolute(project)) throw new Error(`Project path must be absolute: ${project}`);
        const realPath = fs.realpathSync(project);
        if (!fs.statSync(realPath).isDirectory()) throw new Error(`Project path is not a directory: ${project}`);
        if (!fs.existsSync(path.join(realPath, 'assets')) || !fs.existsSync(path.join(realPath, 'project.json'))) {
            throw new Error(`Not a Cocos Creator project: ${project}`);
        }
        return realPath;
    });
    if (new Set(canonical).size !== canonical.length) throw new Error('Project paths must be unique.');
    return { help: false, projects: canonical };
}

function makeConfig(projects, nodeExecutable = fs.realpathSync(process.execPath)) {
    if (!fs.existsSync(mcpEntry)) throw new Error(`CocosAgent MCP server not found: ${mcpEntry}`);
    if (!fs.existsSync(path.join(mcpDirectory, 'node_modules/@modelcontextprotocol/server'))) {
        throw new Error('MCP dependencies are missing. Run `npm ci` in tools/cocos-agent-bridge/mcp first.');
    }
    return {
        mcpServers: {
            'cocos-agent-2x': {
                command: nodeExecutable,
                cwd: mcpDirectory,
                args: [mcpEntry, ...projects.flatMap((project) => ['--project', project])],
                enabled: true,
                default_tools_approval_mode: 'prompt',
                tools: Object.fromEntries([
                    'cocos_2x_instances_list',
                    'cocos_2x_instances_get',
                    'cocos_2x_capabilities_list',
                    'cocos_2x_scene_snapshot',
                    'cocos_2x_scene_node_inspect',
                    'cocos_2x_asset_search_png',
                    'cocos_2x_asset_validate_png',
                ].map((name) => [name, { approval_mode: 'approve' }])),
                startup_timeout_sec: 20,
                tool_timeout_sec: 3600,
                env: {},
            },
        },
    };
}

function configure(args, options = {}) {
    const parsed = parseArgs(args);
    if (parsed.help) return { help: true, outputPath, json: null };
    const json = `${JSON.stringify(makeConfig(parsed.projects, options.nodeExecutable), null, 2)}\n`;
    if (!options.dryRun) fs.writeFileSync(outputPath, json, { encoding: 'utf8', mode: 0o600 });
    return { help: false, outputPath, json };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try {
        const result = configure(process.argv.slice(2));
        if (result.help) process.stdout.write(`${usage()}\n`);
        else process.stdout.write(`Configured local CocosAgent MCP for ${outputPath}\n`);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 2;
    }
}

export { configure, makeConfig, parseArgs };
