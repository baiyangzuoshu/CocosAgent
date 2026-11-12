#include "AnimationStudy.h"
namespace cocos2d { void Animate3DStudy::run() { float duration=0.3f,elapsed=0.15f; float next=elapsed/duration; std::cout << "Animate3D transition weights current=" << 1-next << " next=" << next << "\n"; } }
