#include "include/CCScheduler.h"

namespace cocos2d {
CCScheduler& CCScheduler::sharedScheduler() {
    static CCScheduler scheduler;
    return scheduler;
}

void CCScheduler::scheduleSelector(CCNode* target, SEL_SCHEDULE selector, float interval) {
    _timers.emplace_back(target, selector, interval);
}

void CCScheduler::tick(float delta) {
    for (Timer& timer : _timers) {
        if (timer.elapsed < 0.0f) {
            timer.elapsed = 0.0f;
        } else {
            timer.elapsed += delta;
        }

        if (timer.elapsed >= timer.interval) {
            (timer.target->*timer.selector)(timer.elapsed);
            timer.elapsed = 0.0f;
        }
    }
}
} // namespace cocos2d
