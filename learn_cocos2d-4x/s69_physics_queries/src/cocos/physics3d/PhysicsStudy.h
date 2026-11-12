#pragma once
#include <iostream>
#include <string>
#include <vector>
namespace cocos2d {
struct HitResultStudy { std::string name; float distance; float position; float normal; };
class Physics3DWorldStudy { public: bool rayCast(const std::vector<HitResultStudy>& hits, float maxDistance, HitResultStudy& result) const; };
void runLesson();
}
