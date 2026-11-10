#pragma once

#include "cocos/2d/CCActionInterval.h"

namespace cocos2d {

class ActionEase : public ActionInterval {
public:
    explicit ActionEase(ActionInterval* innerAction);
    void startWithTarget(Node* target) override;

protected:
    ActionInterval* _innerAction;
};

class EaseIn : public ActionEase {
public:
    EaseIn(ActionInterval* innerAction, float rate);
    void update(float progress) override;

private:
    float _rate;
};

} // namespace cocos2d
