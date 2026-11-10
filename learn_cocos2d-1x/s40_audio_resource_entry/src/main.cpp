#include "CocosDenshion/include/SimpleAudioEngine.h"

int main() {
  CocosDenshion::SimpleAudioEngine::sharedEngine()
      ->playEffect("assets/click.wav");
  return 0;
}
