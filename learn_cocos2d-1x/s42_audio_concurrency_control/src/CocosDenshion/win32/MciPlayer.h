#pragma once

#include <string>

namespace CocosDenshion {

class MciPlayer {
public:
  void Open(const std::string& path, unsigned int soundId);
  void Play(bool loop);
  void Pause();
  void Resume();
  void Stop();
  bool IsPlaying() const;

private:
  std::string _path;
  unsigned int _soundId = 0;
  bool _playing = false;
  bool _paused = false;
};

}
