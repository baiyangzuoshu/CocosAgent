#pragma once

#include "cocos2dx/actions/CCAction.h"

namespace cocos2d {

class CCActionInterval : public CCAction {
public:
    explicit CCActionInterval(float duration);
    void startWithTarget(CCNode* target) override;
    void step(ccTime dt) override;
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

class CCMoveTo : public CCActionInterval {
public:
    CCMoveTo(float duration, float endX);
    void startWithTarget(CCNode* target) override;

protected:
    void update(float progress) override;

private:
    float _startX = 0.0f;
    float _deltaX = 0.0f;
    float _endX;
};

} // namespace cocos2d
