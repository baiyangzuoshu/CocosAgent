#pragma once

#include <iostream>

namespace cocos2d {
class CCGLView {
public:
    void setViewPortInPoints(int x, int y, int width, int height) const {
        std::cout << "CCEGLView::setViewPortInPoints(" << x << ", " << y
                  << ", " << width << ", " << height << ")\n";
    }
};
}
