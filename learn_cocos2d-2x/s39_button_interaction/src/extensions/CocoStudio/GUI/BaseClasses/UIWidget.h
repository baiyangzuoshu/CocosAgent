#pragma once
#include <functional>
namespace cocos2d { namespace ui {
struct Point { float x; float y; };
struct Rect { float x; float y; float width; float height; };
enum TouchEventType { TOUCH_EVENT_BEGAN, TOUCH_EVENT_MOVED, TOUCH_EVENT_ENDED, TOUCH_EVENT_CANCELED };
class Widget {
 public:
  using TouchCallback = std::function<void(TouchEventType)>;
  explicit Widget(Rect bounds) : _bounds(bounds) {}
  void addTouchEventListener(const TouchCallback& callback) { _touchCallback = callback; }
  bool onTouchBegan(Point point);
  void onTouchMoved(Point point);
  void onTouchEnded();
  void onTouchCancelled();
  bool isFocused() const { return _focused; }
  void setTouchEnabled(bool enabled) { _touchEnabled = enabled; }
 protected:
  virtual void onPressStateChangedToNormal() {}
  virtual void onPressStateChangedToPressed() {}
  virtual void onPressStateChangedToDisabled() {}
 private:
  bool hitTest(Point point) const;
  void setFocused(bool focused);
  void releaseUpEvent();
  void cancelUpEvent();
  void pushDownEvent();
  void moveEvent();
  Rect _bounds;
  TouchCallback _touchCallback;
  bool _touchEnabled = true;
  bool _enabled = true;
  bool _focused = false;
};
}}
