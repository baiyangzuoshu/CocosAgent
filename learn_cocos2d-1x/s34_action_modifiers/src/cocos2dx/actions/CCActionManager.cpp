#include "cocos2dx/actions/CCActionManager.h"
#include "cocos2dx/base_nodes/CCNode.h"
#include "cocos2dx/CCScheduler.h"

namespace cocos2d {

CCActionManager::CCActionManager(CCScheduler* scheduler)
    : _scheduler(scheduler) {
    init();
}

bool CCActionManager::init() {
    _scheduler->scheduleUpdateForTarget(this); // 1.x: init() 注册自身。
    return true;
}

void CCActionManager::addAction(CCAction* action, CCNode* target) {
    action->startWithTarget(target);
    _entries.push_back({target, action});
}

void CCActionManager::update(ccTime dt) {
    for (auto it = _entries.begin(); it != _entries.end();) {
        if (it->target && it->action) it->action->step(dt);
        if (!it->action || it->action->isDone()) it = _entries.erase(it);
        else ++it;
    }
}

std::size_t CCActionManager::runningActionCount() const {
    return _entries.size();
}

} // namespace cocos2d
