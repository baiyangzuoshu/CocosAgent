#pragma once

#include "../support/component/CCComponentContainer.h"

namespace cocos2d {
class CCComponent;

class CCNode {
public:
    CCNode() : _components(this) {}
    bool addComponent(CCComponent* component);
    bool removeComponent(CCComponent* component);
    void update(float delta);

private:
    CCComponentContainer _components;
};
} // namespace cocos2d
