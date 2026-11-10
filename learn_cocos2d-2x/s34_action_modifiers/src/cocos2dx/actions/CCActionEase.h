#pragma once

#include "cocos2dx/actions/CCActionInterval.h"

namespace cocos2d {

class CCActionEase : public CCActionInterval {
public:
    explicit CCActionEase(CCActionInterval* innerAction);
    void startWithTarget(CCNode* target) override;

protected:
    CCActionInterval* _innerAction;
};

class CCEaseIn : public CCActionEase {
public:
    CCEaseIn(CCActionInterval* innerAction, float rate);
    void update(float progress) override;

private:
    float _rate;
};

} // namespace cocos2d
