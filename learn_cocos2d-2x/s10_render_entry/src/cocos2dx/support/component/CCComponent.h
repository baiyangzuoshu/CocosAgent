#pragma once

namespace cocos2d {
class CCNode;

class CCComponent {
public:
    CCComponent() : _owner(nullptr) {}
    virtual ~CCComponent() = default;

    CCNode* getOwner() const { return _owner; }
    void setOwner(CCNode* owner) { _owner = owner; }
    virtual void onEnter() {}
    virtual void update(float) {}
    virtual void onExit() {}

private:
    CCNode* _owner;
};
} // namespace cocos2d
