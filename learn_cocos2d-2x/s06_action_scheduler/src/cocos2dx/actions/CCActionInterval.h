#pragma once

#include "cocos2dx/actions/CCAction.h"

namespace cocos2d {

class CCActionInterval : public CCAction {
public:
    explicit CCActionInterval(float duration);
    void startWithTarget(CCNode* target) override;
    void step(float dt) override;
    bool isDone() const override;

protected:
    virtual void update(float progress) = 0;

private:
    float _duration;
    float _elapsed = 0.0f;
    bool _firstTick = true;
};

class CCMoveBy : public CCActionInterval {
public:
    CCMoveBy(float duration, float deltaX);
    void startWithTarget(CCNode* target) override;

protected:
    void update(float progress) override;

private:
    float _startX = 0.0f;
    float _deltaX;
};

} // namespace cocos2d
