#include "CCNode.h"
#include "../CCScheduler.h"

namespace cocos2d {
void CCNode::scheduleUpdate() {
    CCScheduler::sharedScheduler().scheduleUpdateForTarget(this);
}

void CCNode::update(float) {}
} // namespace cocos2d
