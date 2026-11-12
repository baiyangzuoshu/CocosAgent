#include "ParticleStudy.h"
namespace cocos2d { void ParticleStudy::run() { float rate=10, remainder=0; int alive=0,capacity=8; float dt=0.5f; remainder+=rate*dt; int emitted=std::min(capacity-alive,static_cast<int>(remainder)); alive+=emitted; std::cout << "emitted=" << emitted << " alive=" << alive << "\n"; } }
