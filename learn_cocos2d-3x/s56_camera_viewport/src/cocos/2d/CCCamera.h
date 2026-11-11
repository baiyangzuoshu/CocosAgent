#pragma once

namespace cocos2d {
class Camera {
public:
    Camera(const char* name, int depth, int x, int y, int width, int height)
        : _name(name), _depth(depth), _x(x), _y(y), _width(width), _height(height) {}
    const char* getName() const { return _name; }
    int getRenderOrder() const { return _depth; }
    void apply() const;
    void clearBackground() const;
    void restore() const;

private:
    const char* _name;
    int _depth;
    int _x;
    int _y;
    int _width;
    int _height;
};
}
