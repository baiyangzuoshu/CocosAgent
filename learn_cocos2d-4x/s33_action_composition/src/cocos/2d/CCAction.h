#pragma once

namespace cocos2d {

class Node;

class Action {
public:
    virtual ~Action() = default;
    virtual void startWithTarget(Node* target);
    virtual void step(float dt) = 0;
    virtual bool isDone() const = 0;

protected:
    Node* _target = nullptr;
};

class FiniteTimeAction : public Action {
public:
    explicit FiniteTimeAction(float duration);
    float getDuration() const;
    virtual void update(float progress) = 0;

private:
    float _duration;
};

} // namespace cocos2d
