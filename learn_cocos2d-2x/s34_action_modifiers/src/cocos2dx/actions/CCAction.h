#pragma once

namespace cocos2d {

class CCNode;

class CCAction {
public:
    virtual ~CCAction() = default;
    virtual void startWithTarget(CCNode* target);
    virtual void step(float dt) = 0;
    virtual bool isDone() const = 0;

protected:
    CCNode* _target = nullptr;
};

class CCFiniteTimeAction : public CCAction {
public:
    explicit CCFiniteTimeAction(float duration);
    float getDuration() const;
    virtual void update(float progress) = 0;

private:
    float _duration;
};

} // namespace cocos2d
