#pragma once
#include <functional>
namespace cocos2d {
struct CCTouch { int id; float x, y; };
class CCEGLViewProtocol {
public:
    std::function<void(const CCTouch&)> touchesBegan;
    void handleTouchesBegin(int id, float x, float y) const {
        (void)id; // 本课只有一个触摸，分配第 0 号触摸槽。
        CCTouch touch{0, (x - 10) / 2, (y - 20) / 2};
        if (touchesBegan) touchesBegan(touch);
    }
};
}
