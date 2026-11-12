#include "AnimationStudy.h"
namespace cocos2d { void CCAnimationStudy::run() { const std::vector<std::string> frames{"run-0","run-1","run-2"}; float duration=frames.size()*0.1f; std::cout << "CCAnimation frames=" << frames.size() << " duration=" << duration << "s\n"; } }
