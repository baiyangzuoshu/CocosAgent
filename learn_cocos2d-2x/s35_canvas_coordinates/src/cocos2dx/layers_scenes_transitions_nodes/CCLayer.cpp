#include "cocos2dx/layers_scenes_transitions_nodes/CCLayer.h"

namespace cocos2d {

bool CCLayer::init(const CCDirector& director) {
  _contentSize = director.getWinSize();
  return true;
}

CCSize CCLayer::getContentSize() const {
  return _contentSize;
}

} // namespace cocos2d
