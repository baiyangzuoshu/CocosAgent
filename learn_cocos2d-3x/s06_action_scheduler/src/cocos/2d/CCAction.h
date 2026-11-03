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

} // namespace cocos2d
