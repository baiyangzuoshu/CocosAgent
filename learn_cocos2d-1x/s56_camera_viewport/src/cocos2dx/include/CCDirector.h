#pragma once

#include "../platform/CCGLView.h"

enum CCProjection {
    kCCDirectorProjection2D,
    kCCDirectorProjection3D,
};

class CCDirector {
public:
    explicit CCDirector(const CCGLView& view) : _view(view), _width(960), _height(640) {}
    void setProjection(CCProjection projection);

private:
    const CCGLView& _view;
    int _width;
    int _height;
};
