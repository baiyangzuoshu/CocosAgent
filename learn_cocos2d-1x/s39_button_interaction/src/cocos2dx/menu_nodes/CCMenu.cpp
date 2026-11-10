#include "cocos2dx/include/CCMenu.h"
namespace cocos2d {
CCMenuItem* CCMenu::itemForTouch(Point point) const {
  for (CCMenuItem* item : _items) {
    if (item->getIsEnabled() && item->contains(point)) return item;
  }
  return nullptr;
}
bool CCMenu::ccTouchBegan(Point point) {
  if (_state != WAITING) return false;
  _selectedItem = itemForTouch(point);
  if (!_selectedItem) return false;
  _state = TRACKING_TOUCH;
  _selectedItem->selected();
  return true;
}
void CCMenu::ccTouchMoved(Point point) {
  if (_state != TRACKING_TOUCH) return;
  CCMenuItem* current = itemForTouch(point);
  if (current == _selectedItem) return;
  if (_selectedItem) _selectedItem->unselected();
  _selectedItem = current;
  if (_selectedItem) _selectedItem->selected();
}
void CCMenu::ccTouchEnded() {
  if (_selectedItem) {
    _selectedItem->unselected();
    _selectedItem->activate();
  }
  _selectedItem = nullptr;
  _state = WAITING;
}
void CCMenu::ccTouchCancelled() {
  if (_selectedItem) _selectedItem->unselected();
  _selectedItem = nullptr;
  _state = WAITING;
}
}
