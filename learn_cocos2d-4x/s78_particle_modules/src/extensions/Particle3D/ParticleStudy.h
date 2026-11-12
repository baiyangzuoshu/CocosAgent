#pragma once
#include <algorithm>
#include <iostream>
#include <vector>
namespace cocos2d { struct Particle { float age; float life; float x; float vx; float size=1; }; class ParticleStudy { public: static void run(); }; }
