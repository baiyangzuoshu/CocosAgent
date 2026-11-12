#include "AnimationStudy.h"
namespace cocos2d { void Animate3DStudy::run() { float time=0.75f,lt=0.5f,lv=10.0f,rt=1.0f,rv=20.0f; float t=(time-lt)/(rt-lt); std::cout << "sample t=" << t << " bone.x=" << lv+(rv-lv)*t << "\n"; } }
