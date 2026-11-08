#pragma once

#include <vector>
#include "CCNode.h"

namespace cocos2d {
class CCScheduler {
public:
    static CCScheduler& sharedScheduler();
    void scheduleSelector(CCNode* target, SEL_SCHEDULE selector, float interval);
    void tick(float delta);

private:
    struct Timer {
        Timer(CCNode* timerTarget, SEL_SCHEDULE timerSelector, float timerInterval)
            : target(timerTarget), selector(timerSelector), interval(timerInterval), elapsed(-1.0f) {}
        CCNode* target;
        SEL_SCHEDULE selector;
        float interval;
        float elapsed;
    };
    std::vector<Timer> _timers;
};
} // namespace cocos2d
