#include "CocosDenshion/include/SimpleAudioEngine.h"

int main() {
  auto* engine = CocosDenshion::SimpleAudioEngine::sharedEngine();
  const unsigned int soundId = engine->playEffect("assets/click.wav");
  engine->pauseEffect(soundId);
  engine->resumeEffect(soundId);
  engine->stopEffect(soundId);
  return 0;
}
