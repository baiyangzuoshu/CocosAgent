#include "cocos/ui/UIButton.h"
#include <iostream>
#include <vector>
using namespace cocos2d::ui;
const char* name(TouchEventType event) {
  switch (event) {
    case TouchEventType::BEGAN: return "BEGAN";
    case TouchEventType::MOVED: return "MOVED";
    case TouchEventType::ENDED: return "ENDED";
    case TouchEventType::CANCELED: return "CANCELED";
  }
  return "?";
}
int main() {
  Button button({0, 0, 100, 48});
  std::vector<TouchEventType> events;
  int clicks = 0;
  button.addTouchEventListener([&](TouchEventType event) { events.push_back(event); });
  button.addClickEventListener([&]() { ++clicks; });
  button.onTouchBegan({40, 20});
  std::cout << "pressed: highlighted=" << button.isHighlighted() << ", visual=" << button.getVisualState() << "\n";
  button.onTouchMoved({160, 20});
  button.onTouchEnded();
  std::cout << "release outside: event=" << name(events.back()) << ", clicks=" << clicks << "\n";
  events.clear();
  button.onTouchBegan({40, 20});
  button.onTouchEnded();
  std::cout << "tap inside: event=" << name(events.back()) << ", clicks=" << clicks << "\n";
}
