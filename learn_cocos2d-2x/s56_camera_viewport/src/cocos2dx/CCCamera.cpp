#include "include/CCCamera.h"

#include <iostream>

namespace cocos2d {
void CCCamera::setEyeXYZ(float x, float y, float z) {
    _eyeX = x;
    _eyeY = y;
    _eyeZ = z;
    _dirty = true;
}

void CCCamera::locate() {
    if (_dirty) {
        std::cout << "kmMat4LookAt(eye=" << _eyeX << "," << _eyeY << "," << _eyeZ
                  << ", center, up); _dirty=false\n";
    }
    std::cout << "kmGLMultMatrix(lookupMatrix)\n";
}
}
