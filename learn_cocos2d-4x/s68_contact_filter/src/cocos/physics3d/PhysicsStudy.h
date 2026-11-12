#pragma once
#include <iostream>
#include <string>
namespace cocos2d {
struct Physics3DObjectStudy { std::string name; unsigned mask; bool trigger; void onContact(const std::string& other) const { std::cout << name << " collision with " << other << "\n"; } };
inline bool shouldCollide(const Physics3DObjectStudy& a, const Physics3DObjectStudy& b) { return (a.mask & b.mask) != 0; }
void runLesson();
}
