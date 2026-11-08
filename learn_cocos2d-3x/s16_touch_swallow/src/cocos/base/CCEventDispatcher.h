#pragma once
#include "CCEventListenerTouch.h"
#include <algorithm>
#include <vector>
namespace cocos2d {
class EventDispatcher {
public:
    void addEventListener(EventListenerTouchOneByOne* listener, int priority) {
        _listeners.push_back({listener, priority});
        std::stable_sort(_listeners.begin(), _listeners.end(), [](const Entry& a, const Entry& b) { return a.priority < b.priority; });
    }
    void dispatchEvent(const EventTouch& event) const {
        for (const auto& entry : _listeners) {
            auto* listener = entry.listener;
            const bool claimed = listener->onTouchBegan && listener->onTouchBegan(event.touch);
            if (claimed && listener->isSwallowTouches()) break;
        }
    }
private:
    struct Entry { EventListenerTouchOneByOne* listener; int priority; };
    std::vector<Entry> _listeners;
};
}
