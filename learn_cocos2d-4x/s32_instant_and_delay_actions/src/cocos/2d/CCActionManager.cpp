#include "cocos/2d/CCActionManager.h"
#include "cocos/2d/CCNode.h"

namespace cocos2d {

void ActionManager::addAction(Action* action, Node* target) {
    action->startWithTarget(target);
    _entries.push_back({target, action});
}

void ActionManager::update(float dt) {
    for (auto it = _entries.begin(); it != _entries.end();) {
        if (it->target && it->action) it->action->step(dt);
        if (!it->action || it->action->isDone()) it = _entries.erase(it);
        else ++it;
    }
}

std::size_t ActionManager::runningActionCount() const {
    return _entries.size();
}

} // namespace cocos2d
