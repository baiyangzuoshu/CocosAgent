#pragma once

class CCCamera {
public:
    CCCamera();
    void setEyeXYZ(float x, float y, float z);
    void locate();

private:
    float m_eyeX;
    float m_eyeY;
    float m_eyeZ;
    bool m_dirty;
};
