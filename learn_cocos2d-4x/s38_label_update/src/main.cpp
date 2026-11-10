#include "cocos/ui/UIText.h"
#include <iostream>
static void print(const char* phase, const cocos2d::ui::Text& text) {
  const auto size = text.getContentSize();
  std::cout << phase << ": \"" << text.getString() << "\", size=" << size.width << "x" << size.height
            << ", adaptDirty=" << text.isAdaptDirty() << "\n";
}
int main() {
  cocos2d::ui::Text score;
  score.setString("Score 9");
  score.visit();
  print("first visit", score);
  score.setString("Score 10");
  print("after setString", score);
  score.visit();
  print("after visit", score);
}
