#pragma once

#include "cocos2dx/actions/CCAction.h"

#include <memory>

namespace cocos2d {

class CCActionInterval : public CCFiniteTimeAction {
public:
    explicit CCActionInterval(float duration);
    void startWithTarget(CCNode* target) override;
    void step(ccTime dt) override;
    bool isDone() const override;
    float progress() const;
    void update(float progress) override = 0;

private:
    float _elapsed = 0.0f;
    bool _firstTick = true;
};

class CCDelayTime : public CCActionInterval {
public:
    explicit CCDelayTime(float duration);
    void update(float progress) override;
};

class CCSequence : public CCActionInterval {
public:
    CCSequence(CCFiniteTimeAction* first, CCFiniteTimeAction* second);
    void startWithTarget(CCNode* target) override;
    void update(float progress) override;

private:
    CCFiniteTimeAction* _first;
    CCFiniteTimeAction* _second;
    float _split;
    int _last = -1;
};

class CCSpawn : public CCActionInterval {
public:
    CCSpawn(CCFiniteTimeAction* first, CCFiniteTimeAction* second);
    void startWithTarget(CCNode* target) override;
    void update(float progress) override;

private:
    std::unique_ptr<CCDelayTime> _firstDelay;
    std::unique_ptr<CCSequence> _firstPadding;
    std::unique_ptr<CCDelayTime> _secondDelay;
    std::unique_ptr<CCSequence> _secondPadding;
    CCFiniteTimeAction* _first;
    CCFiniteTimeAction* _second;
};

} // namespace cocos2d
