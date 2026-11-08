#include "CCComponentContainer.h"
#include "CCComponent.h"
#include <algorithm>

namespace cocos2d {
bool CCComponentContainer::add(CCComponent* component) {
    if (!component || component->getOwner()) return false;
    component->setOwner(_owner);
    _components.push_back(component);
    component->onEnter();
    return true;
}

bool CCComponentContainer::remove(CCComponent* component) {
    auto it = std::find(_components.begin(), _components.end(), component);
    if (it == _components.end()) return false;
    component->onExit();
    component->setOwner(nullptr);
    _components.erase(it);
    return true;
}

void CCComponentContainer::removeAll() {
    while (!_components.empty()) remove(_components.back());
}

void CCComponentContainer::visit(float delta) {
    for (CCComponent* component : _components) component->update(delta);
}
} // namespace cocos2d
