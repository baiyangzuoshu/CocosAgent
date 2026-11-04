#pragma once

namespace cocos2d {
class CCNode;
using SEL_SCHEDULE = void (CCNode::*)(float);

class CCNode {
public:
    virtual ~CCNode() = default;
    void schedule(SEL_SCHEDULE selector, float interval);
    virtual void onTimer(float elapsed);
};
} // namespace cocos2d
