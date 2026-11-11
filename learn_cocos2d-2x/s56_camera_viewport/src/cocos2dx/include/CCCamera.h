#pragma once

namespace cocos2d {
class CCCamera {
public:
    void setEyeXYZ(float x, float y, float z);
    void locate();

private:
    float _eyeX = 0;
    float _eyeY = 0;
    float _eyeZ = 1;
    bool _dirty = false;
};
}
