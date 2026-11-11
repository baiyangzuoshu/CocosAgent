#include "CCDirector.h"

#include <iostream>

namespace cocos2d {
void Director::setProjection(Projection projection) {
    if (_width == 0 || _height == 0) return;
    _view.setViewPortInPoints(0, 0, _width, _height);
    if (projection == Projection::_2D) {
        std::cout << "Director::loadMatrix(PROJECTION, orthographic)\n";
    } else {
        std::cout << "Director::loadMatrix(PROJECTION, perspective * lookAt)\n";
    }
    std::cout << "Director::loadIdentityMatrix(MODELVIEW)\n";
}

void Director::loadCameraProjection(const char* cameraName) const {
    std::cout << "Director::loadMatrix(PROJECTION, " << cameraName
              << ".viewProjection)\n";
}
}
