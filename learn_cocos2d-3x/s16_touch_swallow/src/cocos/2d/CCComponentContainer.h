#pragma once

#include <vector>

namespace cocos2d {
class Component;
class Node;

class ComponentContainer {
public:
    explicit ComponentContainer(Node* owner) : _owner(owner) {}
    bool add(Component* component);
    bool remove(Component* component);
    void onEnter();
    void onExit();
    void visit(float delta);

private:
    Node* _owner;
    std::vector<Component*> _components;
};
} // namespace cocos2d
