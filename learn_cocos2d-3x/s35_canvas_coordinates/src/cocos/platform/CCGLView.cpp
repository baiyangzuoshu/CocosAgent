#include "cocos/platform/CCGLView.h"

#include <algorithm>

namespace cocos2d {

GLView::GLView(float frameWidth, float frameHeight)
    : _screenSize{frameWidth, frameHeight},
      _designResolutionSize{frameWidth, frameHeight} {
}

void GLView::setDesignResolutionSize(
    float width, float height, ResolutionPolicy policy) {
  if (width <= 0 || height <= 0) return;
  _designResolutionSize = {width, height};
  const float scaleX = _screenSize.width / width;
  const float scaleY = _screenSize.height / height;
  _scale = policy == ResolutionPolicy::SHOW_ALL
      ? std::min(scaleX, scaleY)
      : std::max(scaleX, scaleY);

  _viewPortRect.width = width * _scale;
  _viewPortRect.height = height * _scale;
  _viewPortRect.x = (_screenSize.width - _viewPortRect.width) / 2;
  _viewPortRect.y = (_screenSize.height - _viewPortRect.height) / 2;
}

const Size& GLView::getDesignResolutionSize() const {
  return _designResolutionSize;
}

Size GLView::getVisibleSize() const {
  return _designResolutionSize;
}

Vec2 GLView::getVisibleOrigin() const {
  return {0, 0};
}

Rect GLView::getViewPortRect() const {
  return _viewPortRect;
}

Vec2 GLView::convertToFrame(Vec2 point) const {
  return {_viewPortRect.x + point.x * _scale, _viewPortRect.y + point.y * _scale};
}

} // namespace cocos2d
