#include "CCCamera.h"

#include <iostream>

CCCamera::CCCamera() : m_eyeX(0), m_eyeY(0), m_eyeZ(0.001f), m_dirty(false) {}

void CCCamera::setEyeXYZ(float x, float y, float z) {
    m_eyeX = x;
    m_eyeY = y;
    m_eyeZ = z;
    m_dirty = true;
}

void CCCamera::locate() {
    if (!m_dirty) return;
    std::cout << "CCCamera::locate -> gluLookAt eye=(" << m_eyeX << ", " << m_eyeY
              << ", " << m_eyeZ << ")\n";
    m_dirty = false;
}
