#pragma once

#include "cocos/2d/CCAction.h"

#include <functional>

namespace cocos2d {

class ActionInstant : public Action {
public:
    void startWithTarget(Node* target) override;
    void step(float dt) override;
    bool isDone() const override;

protected:
    virtual void update(float time);

private:
    bool _done = false;
};

class CallFunc : public ActionInstant {
public:
    explicit CallFunc(std::function<void()> callback);

protected:
    void update(float time) override;

private:
    std::function<void()> _callback;
};

} // namespace cocos2d
