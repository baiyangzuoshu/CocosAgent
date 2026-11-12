#pragma once
#include <set>
#include <string>
#include <iostream>
namespace cocos2d {
class Physics3DWorldStudy { public: void add(const std::string& name) { bodies.insert(name); std::cout << "world.add(" << name << ")\n"; } void remove(const std::string& name) { bodies.erase(name); std::cout << "world.remove(" << name << ")\n"; } void step() { std::cout << "Physics3DWorld.stepSimulate(1/60)\n"; } std::set<std::string> bodies; };
class Physics3DComponentStudy { public: explicit Physics3DComponentStudy(std::string value) : name(std::move(value)), nodeY(2.0f) {} void onEnter(Physics3DWorldStudy& world) { world.add(name); } void syncPhysicsToNode(float bodyY) { nodeY = bodyY; std::cout << "node.y = " << nodeY << "\n"; } void onExit(Physics3DWorldStudy& world) { world.remove(name); } std::string name; float nodeY; };
void runLesson();
}
