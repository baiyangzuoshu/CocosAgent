#pragma once

#include "cocos/2d/CCAction.h"

namespace cocos2d {

class ActionInterval : public Action {
public:
    explicit ActionInterval(float duration);
    void startWithTarget(Node* target) override;
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

class DelayTime : public ActionInterval {
public:
    explicit DelayTime(float duration);

protected:
    void update(float progress) override;
};

class MoveBy : public ActionInterval {
public:
    MoveBy(float duration, float deltaX);
    void startWithTarget(Node* target) override;

protected:
    void update(float progress) override;

protected:
    float _startX = 0.0f;
    float _deltaX;
};

class MoveTo : public MoveBy {
public:
    MoveTo(float duration, float endX);
    void startWithTarget(Node* target) override;

private:
    float _endX;
};

} // namespace cocos2d
