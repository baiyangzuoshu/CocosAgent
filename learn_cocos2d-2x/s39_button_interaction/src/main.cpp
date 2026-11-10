#include "extensions/CocoStudio/GUI/UIWidgets/UIButton.h"
#include <iostream>
#include <vector>
using namespace cocos2d::ui;
const char* name(TouchEventType event) {
  switch (event) {
    case TOUCH_EVENT_BEGAN: return "BEGAN";
    case TOUCH_EVENT_MOVED: return "MOVED";
    case TOUCH_EVENT_ENDED: return "ENDED";
    case TOUCH_EVENT_CANCELED: return "CANCELED";
  }
  return "?";
}
int main() {
  Button button({0, 0, 100, 48});
  button.init();
  std::vector<TouchEventType> events;
  button.addTouchEventListener([&](TouchEventType event) { events.push_back(event); });
  button.onTouchBegan({40, 20});
  std::cout << "pressed: focused=" << button.isFocused() << ", visual=" << button.getVisualState() << "\n";
  button.onTouchMoved({160, 20});
  button.onTouchEnded();
  int activated = 0;
  for (auto event : events) if (event == TOUCH_EVENT_ENDED) ++activated;
  std::cout << "release outside: event=" << name(events.back()) << ", activated=" << activated << "\n";
  events.clear();
  button.onTouchBegan({40, 20});
  button.onTouchEnded();
  for (auto event : events) if (event == TOUCH_EVENT_ENDED) ++activated;
  std::cout << "tap inside: event=" << name(events.back()) << ", activated=" << activated << "\n";
}
