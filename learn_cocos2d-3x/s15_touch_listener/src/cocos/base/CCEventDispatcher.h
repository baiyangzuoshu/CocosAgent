#pragma once
#include "CCEventListenerTouch.h"
#include <vector>
namespace cocos2d {
class EventDispatcher {
public:
    void addEventListener(EventListenerTouchOneByOne* listener) { _listeners.push_back(listener); }
    void dispatchEvent(const EventTouch& event) const {
        for (auto* listener : _listeners) if (listener->onTouchBegan) listener->onTouchBegan(event.touch);
    }
private:
    std::vector<EventListenerTouchOneByOne*> _listeners;
};
}
