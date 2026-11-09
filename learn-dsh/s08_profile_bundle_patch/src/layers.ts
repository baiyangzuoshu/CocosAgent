import type { PatchLayer } from './types.ts';

export const layers: readonly PatchLayer[] = [
  {
    label: 'bundle @deepseek-ai/dsh-base',
    patches: [{
      insert: [
        {
          id: 'system-prompt',
          name: '@deepseek-ai/dsh-system-prompt',
          config: { personaPrefix: '' },
        },
        {
          id: 'sandbox-policy',
          name: '@deepseek-ai/dsh-sandbox-policy',
          config: { mode: 'workspace-write', workspaceRoot: '/repo' },
        },
        {
          id: 'hmr',
          name: '@deepseek-ai/dsh-hmr',
          config: { root: ['.'] },
        },
        {
          id: 'credentials',
          name: '@deepseek-ai/dsh-credentials-local',
          config: { source: 'profile' },
        },
      ],
    }],
  },
  {
    label: 'bundle @deepseek-ai/dsh-headless',
    patches: [
      {
        id: 'system-prompt',
        config: { personaPrefix: 'You are a coding agent powered by {{model}}.' },
      },
      {
        id: 'sandbox-policy',
        inject: ['headlessStartup'],
        config: {
          mode: 'workspace-write',
          workspaceRoot: '/repo',
          additionalWritableRoots: [],
        },
      },
      { id: 'hmr', disabled: true },
      { id: 'credentials', disabled: true },
      {
        insert: [{
          id: 'headless-runner',
          name: '@deepseek-ai/dsh-headless',
          inject: ['headlessStartup'],
        }],
      },
    ],
  },
  {
    label: 'profile custom',
    patches: [
      {
        id: 'sandbox-policy',
        name: '@deepseek-ai/dsh-sandbox-policy',
        config: { mode: 'read-only', workspaceRoot: '/workspace' },
      },
      {
        insert: [{
          id: 'profile-metrics',
          name: '@example/profile-metrics',
          config: { sampleRate: 0.25 },
        }],
      },
    ],
  },
  {
    label: 'home ~/.dsh/cordis.patch.yml',
    patches: [{
      id: 'sandbox-policy',
      config: {
        mode: 'workspace-write',
        workspaceRoot: '/repo',
        additionalWritableRoots: ['/artifacts'],
      },
    }],
  },
  {
    label: '--patch local.yml',
    patches: [
      {
        id: 'sandbox-policy',
        config: {
          mode: 'read-only',
          workspaceRoot: '/repo',
          additionalWritableRoots: [],
        },
      },
      { id: 'headless-runner', disabled: true },
    ],
  },
];
