#include "CCScheduler.h"
#include "base_nodes/CCNode.h"
#include <algorithm>

namespace cocos2d {
CCScheduler& CCScheduler::sharedScheduler() {
    static CCScheduler scheduler;
    return scheduler;
}

void CCScheduler::scheduleUpdateForTarget(CCNode* target) {
    if (std::find(_targets.begin(), _targets.end(), target) == _targets.end()) {
        _targets.push_back(target);
    }
}

void CCScheduler::tick(float delta) {
    for (CCNode* target : _targets) {
        target->update(delta);
    }
}
} // namespace cocos2d
