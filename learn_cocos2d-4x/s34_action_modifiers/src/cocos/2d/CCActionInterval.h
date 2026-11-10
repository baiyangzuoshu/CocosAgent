#pragma once

#include "cocos/2d/CCAction.h"

namespace cocos2d {

class ActionInterval : public FiniteTimeAction {
public:
    explicit ActionInterval(float duration);
    void startWithTarget(Node* target) override;
    void step(float dt) override;
    bool isDone() const override;
    float progress() const;
    void update(float progress) override = 0;

private:
    float _elapsed = 0.0f;
    bool _firstTick = true;
};

class Repeat : public ActionInterval {
public:
    Repeat(ActionInterval* innerAction, unsigned int times);
    void startWithTarget(Node* target) override;
    void update(float progress) override;
    unsigned int currentIteration() const;

private:
    ActionInterval* _innerAction;
    unsigned int _times;
    unsigned int _iteration = 0;
};

class ReverseTime : public ActionInterval {
public:
    explicit ReverseTime(ActionInterval* innerAction);
    void startWithTarget(Node* target) override;
    void update(float progress) override;

private:
    ActionInterval* _innerAction;
};

} // namespace cocos2d
