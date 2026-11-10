#pragma once
#include "cocos2dx/include/CCMenuItem.h"
#include <vector>
namespace cocos2d {
class CCMenu {
 public:
  void addChild(CCMenuItem* item) { _items.push_back(item); }
  bool ccTouchBegan(Point point);
  void ccTouchMoved(Point point);
  void ccTouchEnded();
  void ccTouchCancelled();
 private:
  enum State { WAITING, TRACKING_TOUCH };
  CCMenuItem* itemForTouch(Point point) const;
  std::vector<CCMenuItem*> _items;
  CCMenuItem* _selectedItem = nullptr;
  State _state = WAITING;
};
}
