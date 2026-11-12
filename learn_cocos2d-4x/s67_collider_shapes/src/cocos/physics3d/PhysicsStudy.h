#pragma once
#include <array>
#include <iostream>
namespace cocos2d {
struct PhysicsMaterialStudy { float friction; float restitution; };
class Physics3DShapeStudy { public: Physics3DShapeStudy(std::array<float,3> size, std::array<float,3> scale, PhysicsMaterialStudy m) : material(m) { for (int i=0;i<3;++i) half[i]=size[i]*scale[i]*0.5f; } void print() const { std::cout << "box halfExtents = " << half[0] << ", " << half[1] << ", " << half[2] << "\nfriction = " << material.friction << "\n"; } std::array<float,3> half{}; PhysicsMaterialStudy material; };
void runLesson();
}
