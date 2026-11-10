#pragma once

#include "cocos/2d/CCAction.h"

#include <functional>

namespace cocos2d {

class ActionInstant : public FiniteTimeAction {
public:
    ActionInstant();
    void startWithTarget(Node* target) override;
    void step(float dt) override;
    bool isDone() const override;
    void update(float progress) override;

protected:
    bool _done = false;
};

class CallFunc : public ActionInstant {
public:
    explicit CallFunc(std::function<void()> callback);
    void update(float progress) override;

private:
    std::function<void()> _callback;
};

} // namespace cocos2d
