#include "CCComponentContainer.h"
#include "CCComponent.h"
#include <algorithm>

namespace cocos2d {
bool ComponentContainer::add(Component* component) {
    if (!component || component->getOwner()) return false;
    component->setOwner(_owner);
    _components.push_back(component);
    component->onAdd();
    return true;
}

bool ComponentContainer::remove(Component* component) {
    auto it = std::find(_components.begin(), _components.end(), component);
    if (it == _components.end()) return false;
    _components.erase(it);
    component->onRemove();
    component->setOwner(nullptr);
    return true;
}

void ComponentContainer::onEnter() {
    for (Component* component : _components) component->onEnter();
}

void ComponentContainer::onExit() {
    for (Component* component : _components) component->onExit();
}

void ComponentContainer::visit(float delta) {
    for (Component* component : _components) component->update(delta);
}
} // namespace cocos2d
