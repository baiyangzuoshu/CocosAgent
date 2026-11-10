#pragma once

#include "cocos2dx/actions/CCAction.h"

#include <functional>

namespace cocos2d {

class CCActionInstant : public CCFiniteTimeAction {
public:
    CCActionInstant();
    void step(float dt) override;
    bool isDone() const override;
    void update(float progress) override;

protected:
    bool _done = false;
};

class CCCallFunc : public CCActionInstant {
public:
    explicit CCCallFunc(std::function<void()> callback);
    void update(float progress) override;

private:
    std::function<void()> _callback;
};

} // namespace cocos2d
