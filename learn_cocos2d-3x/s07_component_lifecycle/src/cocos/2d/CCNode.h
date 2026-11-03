#pragma once

#include "CCComponentContainer.h"

namespace cocos2d {
class Component;

class Node {
public:
    Node() : _components(this), _updateScheduled(false) {}
    bool addComponent(Component* component);
    bool removeComponent(Component* component);
    void onEnter();
    void onExit();
    void update(float delta);

private:
    ComponentContainer _components;
    bool _updateScheduled;
};
} // namespace cocos2d
