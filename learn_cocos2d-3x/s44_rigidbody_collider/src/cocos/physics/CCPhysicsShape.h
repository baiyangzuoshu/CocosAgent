#pragma once

namespace cocos2d {

struct Size { float width; float height; };

struct PhysicsMaterial {
    float density;
    float restitution;
    float friction;
    PhysicsMaterial(float d, float r, float f) : density(d), restitution(r), friction(f) {}
};

class PhysicsShapeBox {
public:
    PhysicsShapeBox(Size size, PhysicsMaterial material) : _size(size), _material(material) {}
    Size _size;
    PhysicsMaterial _material;
};

} // namespace cocos2d
