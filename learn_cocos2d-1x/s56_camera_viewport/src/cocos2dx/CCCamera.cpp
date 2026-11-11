#include "include/CCCamera.h"

#include <iostream>

void CCCamera::setEyeXYZ(float x, float y, float z) {
    _eyeX = x;
    _eyeY = y;
    _eyeZ = z;
    _dirty = true;
}

void CCCamera::locate() {
    if (!_dirty) return;
    std::cout << "CCCamera::locate -> gluLookAt(" << _eyeX << ", " << _eyeY
              << ", " << _eyeZ << ", center, up)\n";
}
