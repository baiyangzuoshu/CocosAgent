#pragma once

#include <iostream>

namespace cocos2d {
class GLView {
public:
    void setViewPortInPoints(int x, int y, int width, int height) const {
        std::cout << "GLView::setViewPortInPoints(" << x << ", " << y << ", "
                  << width << ", " << height << ")\n";
    }
};
}
