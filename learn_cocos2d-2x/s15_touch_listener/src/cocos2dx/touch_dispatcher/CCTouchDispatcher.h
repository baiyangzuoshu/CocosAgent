#pragma once
#include "../platform/CCEGLViewProtocol.h"
#include <functional>
#include <vector>
namespace cocos2d {
class CCTouchDispatcher {
public:
    void addTargetedDelegate(std::function<bool(const CCTouch&)> callback) { _listeners.push_back(callback); }
    void touchesBegan(const CCTouch& touch) const {
        for (const auto& callback : _listeners) callback(touch);
    }
private:
    std::vector<std::function<bool(const CCTouch&)>> _listeners;
};
}
