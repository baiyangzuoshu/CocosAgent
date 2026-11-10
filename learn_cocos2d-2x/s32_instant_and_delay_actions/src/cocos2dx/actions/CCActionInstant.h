#pragma once

#include "cocos2dx/actions/CCAction.h"

#include <functional>

namespace cocos2d {

class CCActionInstant : public CCAction {
public:
    void step(float dt) override;
    bool isDone() const override;

protected:
    virtual void update(float time);
};

class CCCallFunc : public CCActionInstant {
public:
    explicit CCCallFunc(std::function<void()> callback);

protected:
    void update(float time) override;

private:
    std::function<void()> _callback;
};

} // namespace cocos2d
