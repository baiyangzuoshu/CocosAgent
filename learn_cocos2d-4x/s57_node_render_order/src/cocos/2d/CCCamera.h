#pragma once

namespace cocos2d {
class Camera {
public:
    explicit Camera(unsigned short cameraFlag) : _cameraFlag(cameraFlag) {}
    unsigned short getCameraFlag() const { return _cameraFlag; }

private:
    unsigned short _cameraFlag;
};
}
