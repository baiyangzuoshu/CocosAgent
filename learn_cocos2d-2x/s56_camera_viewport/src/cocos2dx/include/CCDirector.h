#pragma once

#include "../platform/CCGLView.h"

namespace cocos2d {
enum ccDirectorProjection {
    kCCDirectorProjection2D,
    kCCDirectorProjection3D,
};

class CCDirector {
public:
    explicit CCDirector(const CCGLView& view) : _view(view), _width(960), _height(640) {}
    void setProjection(ccDirectorProjection projection);

private:
    void setViewport() const;
    const CCGLView& _view;
    int _width;
    int _height;
};
}
