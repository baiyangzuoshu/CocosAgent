#include "AnimationStudy.h"
namespace cocos2d { void CCAnimationStudy::run() { const std::vector<std::string> frames{"run-0","run-1","run-2","run-3"}; float progress=0.6f; size_t index=std::min(frames.size()-1,static_cast<size_t>(progress*frames.size())); std::cout << "progress=" << progress << " selected SpriteFrame=" << frames[index] << " (discrete)\n"; } }
