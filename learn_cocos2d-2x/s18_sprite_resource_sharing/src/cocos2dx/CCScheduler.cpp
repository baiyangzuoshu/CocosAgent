#include "CCScheduler.h"
#include "base_nodes/CCNode.h"
#include <algorithm>

namespace cocos2d {
void CCScheduler::scheduleUpdateForTarget(CCNode* target) {
    if (std::find(_targets.begin(), _targets.end(), target) == _targets.end()) {
        _targets.push_back(target);
    }
}

void CCScheduler::update(float delta) {
    const auto targets = _targets;
    for (CCNode* target : targets) target->update(delta);
}
} // namespace cocos2d
