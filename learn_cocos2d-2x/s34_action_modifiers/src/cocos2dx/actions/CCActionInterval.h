#pragma once

#include "cocos2dx/actions/CCAction.h"

namespace cocos2d {

class CCActionInterval : public CCFiniteTimeAction {
public:
    explicit CCActionInterval(float duration);
    void startWithTarget(CCNode* target) override;
    void step(float dt) override;
    bool isDone() const override;
    float progress() const;
    void update(float progress) override = 0;

private:
    float _elapsed = 0.0f;
    bool _firstTick = true;
};

class CCRepeat : public CCActionInterval {
public:
    CCRepeat(CCActionInterval* innerAction, unsigned int times);
    void startWithTarget(CCNode* target) override;
    void update(float progress) override;
    unsigned int currentIteration() const;

private:
    CCActionInterval* _innerAction;
    unsigned int _times;
    unsigned int _iteration = 0;
};

class CCReverseTime : public CCActionInterval {
public:
    explicit CCReverseTime(CCActionInterval* innerAction);
    void startWithTarget(CCNode* target) override;
    void update(float progress) override;

private:
    CCActionInterval* _innerAction;
};

} // namespace cocos2d
