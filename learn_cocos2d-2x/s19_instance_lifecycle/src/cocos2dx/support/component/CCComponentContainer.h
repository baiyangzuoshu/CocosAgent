#pragma once

#include <vector>

namespace cocos2d {
class CCComponent;
class CCNode;

class CCComponentContainer {
public:
    explicit CCComponentContainer(CCNode* owner) : _owner(owner) {}
    bool add(CCComponent* component);
    bool remove(CCComponent* component);
    void removeAll();
    void visit(float delta);

private:
    CCNode* _owner;
    std::vector<CCComponent*> _components;
};
} // namespace cocos2d
