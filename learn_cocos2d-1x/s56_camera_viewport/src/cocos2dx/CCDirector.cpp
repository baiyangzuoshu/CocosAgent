#include "include/CCDirector.h"

#include <iostream>

void CCDirector::setProjection(CCProjection projection) {
    const float zEye = 1.0f;
    _view.setViewPortInPoints(0, 0, _width, _height);
    std::cout << "glMatrixMode(GL_PROJECTION); glLoadIdentity();\n";

    if (projection == kCCDirectorProjection2D) {
        std::cout << "ccglOrtho(0, " << _width << ", 0, " << _height
                  << ", -1024, 1024)\n";
        std::cout << "glMatrixMode(GL_MODELVIEW); glLoadIdentity()\n";
        return;
    }

    std::cout << "gluPerspective(60, " << _width << "/" << _height
              << ", 0.5, 1500)\n";
    std::cout << "glMatrixMode(GL_MODELVIEW); glLoadIdentity();\n";
    std::cout << "gluLookAt(" << _width / 2 << ", " << _height / 2 << ", "
              << zEye << ", center, up)\n";
}
