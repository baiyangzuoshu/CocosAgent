#pragma once

#include "cocos/2d/CCAction.h"

#include <memory>

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

class DelayTime : public ActionInterval {
public:
    explicit DelayTime(float duration);
    void update(float progress) override;
};

class Sequence : public ActionInterval {
public:
    Sequence(FiniteTimeAction* first, FiniteTimeAction* second);
    void startWithTarget(Node* target) override;
    void update(float progress) override;

private:
    FiniteTimeAction* _first;
    FiniteTimeAction* _second;
    float _split;
    int _last = -1;
};

class Spawn : public ActionInterval {
public:
    Spawn(FiniteTimeAction* first, FiniteTimeAction* second);
    void startWithTarget(Node* target) override;
    void update(float progress) override;

private:
    std::unique_ptr<DelayTime> _firstDelay;
    std::unique_ptr<Sequence> _firstPadding;
    std::unique_ptr<DelayTime> _secondDelay;
    std::unique_ptr<Sequence> _secondPadding;
    FiniteTimeAction* _first;
    FiniteTimeAction* _second;
};

} // namespace cocos2d
