#pragma once

namespace cocos2d {
class CCNode {
public:
    virtual ~CCNode() = default;
    void scheduleUpdate();
    virtual void update(float delta);
};
} // namespace cocos2d
