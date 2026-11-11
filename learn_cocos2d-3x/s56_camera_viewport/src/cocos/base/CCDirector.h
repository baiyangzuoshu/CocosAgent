#pragma once

#include "../platform/CCGLView.h"

namespace cocos2d {
enum class Projection { _2D, _3D };

class Director {
public:
    explicit Director(const GLView& view) : _view(view) {}
    void setProjection(Projection projection);
    void loadCameraProjection(const char* cameraName) const;

private:
    const GLView& _view;
    int _width = 960;
    int _height = 640;
};
}
