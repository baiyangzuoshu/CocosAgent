#pragma once

#include "cocos2dx/actions/CCAction.h"

#include <functional>

namespace cocos2d {

class CCActionInstant : public CCFiniteTimeAction {
public:
    CCActionInstant();
    void step(ccTime dt) override;
    bool isDone() const override;
    void update(float progress) override;
};

class CCCallFunc : public CCActionInstant {
public:
    explicit CCCallFunc(std::function<void()> callback);
    void startWithTarget(CCNode* target) override;

private:
    std::function<void()> _callback;
};

} // namespace cocos2d
