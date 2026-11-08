#pragma once
#include "CCEventTouch.h"
#include <functional>
namespace cocos2d {
class EventDispatcher {
public:
    std::function<void(const EventTouch&)> onTouchBegan;
    void dispatchEvent(const EventTouch& event) const { if (onTouchBegan) onTouchBegan(event); }
};
}
