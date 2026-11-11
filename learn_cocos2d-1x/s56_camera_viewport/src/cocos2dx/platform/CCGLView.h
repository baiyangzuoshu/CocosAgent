#pragma once

#include <iostream>

class CCGLView {
public:
    void setViewPortInPoints(int x, int y, int width, int height) const {
        std::cout << "CCGLView::setViewPortInPoints(" << x << ", " << y
                  << ", " << width << ", " << height << ")\n";
    }
};
