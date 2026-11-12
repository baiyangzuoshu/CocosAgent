#include "AnimationStudy.h"
namespace cocos2d { void Animate3DStudy::run() { float time=0.0f; const float duration=0.3f; const int loops=2; for (int i=0;i<5;++i) { time+=0.15f; if (time>duration*loops) time=duration*loops; std::cout << "time=" << time << " frame=" << std::min(2,static_cast<int>((time/duration)*3)) << "\n"; } } }
