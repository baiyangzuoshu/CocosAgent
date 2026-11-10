#pragma once

#include "cocos2dx/actions/CCAction.h"

namespace cocos2d {

class CCActionInterval : public CCAction {
public:
    explicit CCActionInterval(float duration);
    void startWithTarget(CCNode* target) override;
    void step(float dt) override;
    bool isDone() const override;
    float progress() const;

protected:
    virtual void update(float progress) = 0;

private:
    float _duration;
    float _elapsed = 0.0f;
    bool _firstTick = true;
};

class CCDelayTime : public CCActionInterval {
public:
    explicit CCDelayTime(float duration);

protected:
    void update(float progress) override;
};

} // namespace cocos2d
