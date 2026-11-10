#pragma once
namespace cocos2d {
struct Point { float x; float y; };
struct Rect { float x; float y; float width; float height; };
class CCMenuItem {
 public:
  using Selector = void (*)(void*, CCMenuItem*);
  CCMenuItem(Rect rect, void* target, Selector selector)
      : _rect(rect), _listener(target), _selector(selector) {}
  bool contains(Point p) const;
  bool getIsEnabled() const { return _enabled; }
  void setIsEnabled(bool enabled) { _enabled = enabled; }
  bool getIsSelected() const { return _selected; }
  void selected() { _selected = true; }
  void unselected() { _selected = false; }
  void activate();
 private:
  Rect _rect;
  void* _listener;
  Selector _selector;
  bool _enabled = true;
  bool _selected = false;
};
}
