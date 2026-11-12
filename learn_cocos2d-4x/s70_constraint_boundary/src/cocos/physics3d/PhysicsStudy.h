#pragma once
#include <iostream>
#include <set>
#include <string>
namespace cocos2d {
struct Physics3DConstraintStudy { std::string bodyA; std::string bodyB; std::string type; };
class Physics3DWorldStudy { public: void addPhysics3DConstraint(const Physics3DConstraintStudy& c) { constraints.insert(c.type); std::cout << "add constraint " << c.type << " " << c.bodyA << "-" << c.bodyB << "\n"; } void removePhysics3DConstraint(const Physics3DConstraintStudy& c) { constraints.erase(c.type); } std::set<std::string> constraints; };
void runLesson();
}
