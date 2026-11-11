#include "CCCamera.h"

#include <iostream>

namespace cocos2d {
void Camera::apply() const {
    std::cout << "Camera::apply -> save GL_VIEWPORT; glViewport(" << _x << ", "
              << _y << ", " << _width << ", " << _height << ")\n";
}

void Camera::clearBackground() const {
    std::cout << "Camera::clearBackground(" << _name << ")\n";
}

void Camera::restore() const {
    std::cout << "Camera::restore -> restore FBO and previous glViewport\n";
}
}
