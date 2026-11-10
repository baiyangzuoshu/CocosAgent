#include "cocos2dx/CCDirector.h"

namespace cocos2d {

CCDirector::CCDirector(const CCEGLViewProtocol& view)
    : _view(view) {
}

CCSize CCDirector::getWinSize() const {
  return _view.getDesignResolutionSize();
}

CCSize CCDirector::getVisibleSize() const {
  return _view.getVisibleSize();
}

CCPoint CCDirector::getVisibleOrigin() const {
  return _view.getVisibleOrigin();
}

} // namespace cocos2d
