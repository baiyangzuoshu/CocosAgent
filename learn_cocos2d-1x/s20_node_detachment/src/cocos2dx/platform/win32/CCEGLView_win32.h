#pragma once
#include <functional>
namespace cocos2d {
struct CCTouch { float x, y; };
class CCEGLView {
public:
    std::function<void(const CCTouch&)> touchesBegan;
    void mouseDown(float x, float y) const {
        CCTouch touch{(x - 10) / 2, (y - 20) / 2};
        if (touchesBegan) touchesBegan(touch);
    }
};
}
