#include "cocos/2d/CCLayer.h"

namespace cocos2d {

bool Layer::init(const Director& director) {
  _contentSize = director.getWinSize();
  return true;
}

Size Layer::getContentSize() const {
  return _contentSize;
}

} // namespace cocos2d
