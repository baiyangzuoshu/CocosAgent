#include "cocos2dx/include/CCDirector.h"

namespace cocos2d {

CCDirector::CCDirector(float width, float height, float contentScaleFactor)
    : _winSizeInPoints{width, height},
      _contentScaleFactor(contentScaleFactor) {
}

CCSize CCDirector::getWinSize() const {
  return _winSizeInPoints;
}

CCSize CCDirector::getWinSizeInPixels() const {
  return {
    _winSizeInPoints.width * _contentScaleFactor,
    _winSizeInPoints.height * _contentScaleFactor,
  };
}

} // namespace cocos2d
