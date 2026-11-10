#pragma once

namespace cocos2d {

class CCNode;

class CCAction {
public:
    virtual ~CCAction() = default;
    virtual void startWithTarget(CCNode* target);
    virtual void step(float dt) = 0;
    virtual bool isDone() const = 0;

protected:
    CCNode* _target = nullptr;
};

} // namespace cocos2d
