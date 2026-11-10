#include "cocos2dx/include/CCMenuItem.h"
namespace cocos2d {
bool CCMenuItem::contains(Point p) const {
  return p.x >= _rect.x && p.x <= _rect.x + _rect.width
      && p.y >= _rect.y && p.y <= _rect.y + _rect.height;
}
void CCMenuItem::activate() {
  if (_enabled && _listener && _selector) _selector(_listener, this);
}
}
