#include "cocos2dx/include/CCMenu.h"
#include <iostream>
namespace {
void onPlay(void* context, cocos2d::CCMenuItem*) { ++*static_cast<int*>(context); }
}
int main() {
  int callbacks = 0;
  cocos2d::CCMenu menu;
  cocos2d::CCMenuItem play({0, 0, 100, 48}, &callbacks, onPlay);
  menu.addChild(&play);
  menu.ccTouchBegan({40, 20});
  std::cout << "touch began: selected=" << play.getIsSelected() << "\n";
  menu.ccTouchMoved({160, 20});
  menu.ccTouchEnded();
  std::cout << "release outside: selected=" << play.getIsSelected() << ", callbacks=" << callbacks << "\n";
  menu.ccTouchBegan({40, 20});
  menu.ccTouchEnded();
  std::cout << "release inside: callbacks=" << callbacks << "\n";
}
