#include "CCScheduler.h"
#include "../2d/CCNode.h"
#include <algorithm>

namespace cocos2d {
void Scheduler::scheduleUpdate(Node* target) {
    if (std::find(_targets.begin(), _targets.end(), target) == _targets.end()) {
        _targets.push_back(target);
    }
}

void Scheduler::update(float delta) {
    const auto targets = _targets;
    for (Node* target : targets) target->update(delta);
}
} // namespace cocos2d
