#pragma once

namespace cocos2d {
class Node;

class Component {
public:
    Component() : _owner(nullptr) {}
    virtual ~Component() = default;

    Node* getOwner() const { return _owner; }
    void setOwner(Node* owner) { _owner = owner; }
    virtual void onAdd() {}
    virtual void onEnter() {}
    virtual void update(float) {}
    virtual void onExit() {}
    virtual void onRemove() {}

private:
    Node* _owner;
};
} // namespace cocos2d
