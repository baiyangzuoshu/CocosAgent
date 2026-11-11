#include "include/CCDirector.h"

#include <iostream>

namespace cocos2d {
void CCDirector::setViewport() const {
    _view.setViewPortInPoints(0, 0, _width, _height);
}

void CCDirector::setProjection(ccDirectorProjection projection) {
    setViewport();
    std::cout << "kmGLMatrixMode(KM_GL_PROJECTION); kmGLLoadIdentity()\n";

    if (projection == kCCDirectorProjection2D) {
        std::cout << "kmMat4OrthographicProjection(0, " << _width << ", 0, "
                  << _height << ", -1024, 1024); kmGLMultMatrix(ortho)\n";
    } else {
        std::cout << "kmMat4PerspectiveProjection(60, " << _width << "/" << _height
                  << ", 0.1, zEye*2)\n";
        std::cout << "kmMat4LookAt(eye, center, up); kmGLMultMatrix(lookup)\n";
    }

    std::cout << "kmGLMatrixMode(KM_GL_MODELVIEW); kmGLLoadIdentity()\n";
}
}
