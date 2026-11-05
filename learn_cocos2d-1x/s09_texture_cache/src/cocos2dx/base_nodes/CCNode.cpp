#include "../include/CCNode.h"
#include "../include/CCScheduler.h"

namespace cocos2d {
void CCNode::schedule(SEL_SCHEDULE selector, float interval) {
    CCScheduler::sharedScheduler().scheduleSelector(this, selector, interval);
}

void CCNode::onTimer(float) {}
} // namespace cocos2d
