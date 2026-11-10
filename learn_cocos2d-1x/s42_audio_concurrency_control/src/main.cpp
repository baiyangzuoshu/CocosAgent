#include "CocosDenshion/include/SimpleAudioEngine.h"

int main() {
  auto* engine = CocosDenshion::SimpleAudioEngine::sharedEngine();
  engine->setBackgroundMusicVolume(0.35f);
  engine->playBackgroundMusic("audio/music.ogg", true);

  engine->setEffectsVolume(0.7f);
  engine->playEffect("audio/hit-a.wav");
  engine->playEffect("audio/hit-b.wav");

  engine->stopAllEffects();
  engine->unloadEffect("audio/hit-a.wav");
  engine->stopBackgroundMusic(true);
  return 0;
}
