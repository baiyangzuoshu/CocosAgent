#include "ParticleStudy.h"
namespace cocos2d { void ParticleStudy::run() { float age=0.5f,life=1.0f,vx=2.0f,size=1.0f,red=1.0f,dt=0.25f; float t=age/life; vx+=-4.0f*dt; size+=t; red=1.0f-t; std::cout << "t=" << t << " vx=" << vx << " size=" << size << " red=" << red << "\n"; } }
