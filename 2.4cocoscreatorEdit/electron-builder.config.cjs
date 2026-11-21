const path = require('node:path');

const electronDist = process.env.COCOS_LITE_ELECTRON_DIST;

const config = {
  appId: 'com.youjunmao.cocoscreatorlite',
  productName: 'Cocos Creator Lite',
  electronVersion: '37.10.3',
  npmRebuild: false,
  nodeGypRebuild: false,
  directories: {
    output: 'release',
  },
  files: [
    'package.json',
    'src/**/*',
    'public/**/*',
    'samples/**/*',
  ],
  extraResources: [
    {
      from: 'public/runtime',
      to: 'runtime',
    },
  ],
  asar: true,
  mac: {
    category: 'public.app-category.developer-tools',
    target: ['dir'],
  },
  win: {
    target: ['portable'],
  },
};

if (electronDist) config.electronDist = path.resolve(electronDist);

module.exports = config;
