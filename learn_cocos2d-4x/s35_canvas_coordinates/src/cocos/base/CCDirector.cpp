#include "cocos/base/CCDirector.h"

namespace cocos2d {

void Director::setOpenGLView(const GLView* view) {
  _openGLView = view;
}

const Size& Director::getWinSize() const {
  return _openGLView->getDesignResolutionSize();
}

Size Director::getVisibleSize() const {
  return _openGLView->getVisibleSize();
}

Vec2 Director::getVisibleOrigin() const {
  return _openGLView->getVisibleOrigin();
}

} // namespace cocos2d
