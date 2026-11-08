#pragma once
#include "../base/CCEventDispatcher.h"
namespace cocos2d {
class GLView {
public:
    explicit GLView(EventDispatcher& dispatcher) : _dispatcher(dispatcher) {}
    void handleTouchesBegin(int id, float x, float y) const {
        (void)id; // 本课只有一个触摸，分配第 0 号触摸槽。
        EventTouch event{{0, (x - 10) / 2, (y - 20) / 2}};
        _dispatcher.dispatchEvent(event);
    }
private:
    EventDispatcher& _dispatcher;
};
}
