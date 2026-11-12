#include "AnimationStudy.h"
namespace cocos2d { void Animate3DStudy::run() { const std::vector<float> markers{0.25f,0.75f}; float prev=0.2f,now=0.8f; int fired=0; for(float marker:markers) if(prev<marker && marker<=now) { ++fired; std::cout << "keyframe user event @" << marker << "\n"; } std::cout << "events fired=" << fired << "\n"; } }
