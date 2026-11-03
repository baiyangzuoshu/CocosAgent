#pragma once

#include "cocos/2d/CCAction.h"

namespace cocos2d {

class ActionInterval : public Action {
public:
    explicit ActionInterval(float duration);
    void startWithTarget(Node* target) override;
    void step(float dt) override;
    bool isDone() const override;

protected:
    virtual void update(float progress) = 0;

private:
    float _duration;
    float _elapsed = 0.0f;
    bool _firstTick = true;
};

class MoveBy : public ActionInterval {
public:
    MoveBy(float duration, float deltaX);
    void startWithTarget(Node* target) override;

protected:
    void update(float progress) override;

private:
    float _startX = 0.0f;
    float _deltaX;
};

} // namespace cocos2d
