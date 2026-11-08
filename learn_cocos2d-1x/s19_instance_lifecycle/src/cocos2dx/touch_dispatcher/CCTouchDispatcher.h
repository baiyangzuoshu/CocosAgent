#pragma once
#include "../platform/win32/CCEGLView_win32.h"
#include <algorithm>
#include <functional>
#include <vector>
namespace cocos2d {
class CCTouchDispatcher {
public:
    void addTargetedDelegate(std::function<bool(const CCTouch&)> callback, int priority, bool swallow) {
        _listeners.push_back({callback, priority, swallow});
        std::stable_sort(_listeners.begin(), _listeners.end(), [](const Listener& a, const Listener& b) { return a.priority < b.priority; });
    }
    void touchesBegan(const CCTouch& touch) const {
        for (const auto& listener : _listeners) {
            const bool claimed = listener.callback(touch);
            if (claimed && listener.swallow) break;
        }
    }
private:
    struct Listener { std::function<bool(const CCTouch&)> callback; int priority; bool swallow; };
    std::vector<Listener> _listeners;
};
}
