#include "cocos2dx/platform/CCEGLViewProtocol.h"

#include <algorithm>

namespace cocos2d {

CCEGLViewProtocol::CCEGLViewProtocol(float frameWidth, float frameHeight)
    : _frameSize{frameWidth, frameHeight},
      _designSize{frameWidth, frameHeight} {
}

void CCEGLViewProtocol::setDesignResolutionSize(
    float width, float height, ResolutionPolicy policy) {
  if (width <= 0 || height <= 0) return;
  _designSize = {width, height};
  const float scaleX = _frameSize.width / width;
  const float scaleY = _frameSize.height / height;
  _scale = policy == kResolutionShowAll
      ? std::min(scaleX, scaleY)
      : std::max(scaleX, scaleY);

  _viewport.width = width * _scale;
  _viewport.height = height * _scale;
  _viewport.x = (_frameSize.width - _viewport.width) / 2;
  _viewport.y = (_frameSize.height - _viewport.height) / 2;
}

CCSize CCEGLViewProtocol::getDesignResolutionSize() const {
  return _designSize;
}

CCSize CCEGLViewProtocol::getVisibleSize() const {
  return _designSize;
}

CCPoint CCEGLViewProtocol::getVisibleOrigin() const {
  return {0, 0};
}

CCRect CCEGLViewProtocol::getViewPortRect() const {
  return _viewport;
}

CCPoint CCEGLViewProtocol::convertToFrame(CCPoint point) const {
  return {_viewport.x + point.x * _scale, _viewport.y + point.y * _scale};
}

} // namespace cocos2d
