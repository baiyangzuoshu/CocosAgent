#include "PhysicsStudy.h"
namespace cocos2d { void runLesson() { Physics3DObjectStudy player{"Player", 0x3, false}; Physics3DObjectStudy sensor{"Sensor", 0x1, true}; if (!shouldCollide(player,sensor)) { std::cout << "pair filtered\n"; return; } std::cout << "pair accepted; " << (sensor.trigger ? "trigger-enter\n" : "collision-enter\n"); player.onContact(sensor.name); } }
