
// predefine some modules for cocos
require('./platform/js');
require('./value-types');
require('./utils');
require('./platform/CCInputManager');
require('./platform/CCInputExtension');
require('./event');
require('./platform/CCSys');
require('./platform/CCMacro');
require('./asset-manager');
require('./CCDirector');
require('./renderer');
//非编辑器
if (!(CC_EDITOR && Editor.isMainProcess)) {
    require('./platform/CCView');
    require('./platform/CCScreen');
    require('./CCScheduler');
    require('./event-manager');
}
