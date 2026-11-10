#pragma once

#include "cocos2dx/actions/CCAction.h"

#include <functional>

namespace cocos2d {

class CCActionInstant : public CCAction {
public:
    void step(ccTime dt) override;
    bool isDone() const override;

protected:
    virtual void update(float time);
};

class CCCallFunc : public CCActionInstant {
public:
    explicit CCCallFunc(std::function<void()> callback);
    void startWithTarget(CCNode* target) override;

private:
    std::function<void()> _callback;
};

} // namespace cocos2d
