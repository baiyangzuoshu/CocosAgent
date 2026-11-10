#include "cocos2dx/actions/CCActionManager.h"
#include "cocos2dx/base_nodes/CCNode.h"

namespace cocos2d {

void CCActionManager::addAction(CCAction* action, CCNode* target) {
    action->startWithTarget(target);
    _entries.push_back({target, action});
}

void CCActionManager::update(float dt) {
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
