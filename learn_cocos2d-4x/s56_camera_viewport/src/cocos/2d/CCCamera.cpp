#include "CCCamera.h"

#include "../renderer/CCRenderer.h"

#include <iostream>

namespace cocos2d {
void Camera::apply(Renderer* renderer) const {
    std::cout << "Camera::apply -> Renderer::setViewPort\n";
    renderer->setViewPort(_x, _y, _width, _height);
}

void Camera::clearBackground() const {
    std::cout << "Camera::clearBackground(" << _name << ")\n";
}
}
