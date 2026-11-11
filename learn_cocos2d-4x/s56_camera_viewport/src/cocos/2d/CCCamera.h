#pragma once

namespace cocos2d {
class Renderer;
class Camera {
public:
    Camera(const char* name, int depth, int x, int y, unsigned int width, unsigned int height)
        : _name(name), _depth(depth), _x(x), _y(y), _width(width), _height(height) {}
    const char* getName() const { return _name; }
    int getRenderOrder() const { return _depth; }
    void apply(Renderer* renderer) const;
    void clearBackground() const;

private:
    const char* _name;
    int _depth;
    int _x;
    int _y;
    unsigned int _width;
    unsigned int _height;
};
}
