#include "MciPlayer.h"

#include <iostream>

namespace CocosDenshion {

void MciPlayer::Open(const std::string& path, unsigned int soundId) {
  _path = path;
  _soundId = soundId;
  std::cout << "MciPlayer::Open " << _path << "\n";
}

void MciPlayer::Play(bool loop) {
  std::cout << "MciPlayer::Play " << _path
            << " loop=" << (loop ? "true" : "false") << "\n";
  _playing = true;
  _paused = false;
}

void MciPlayer::Pause() {
  std::cout << "MciPlayer::Pause id=" << _soundId << "\n";
  _playing = false;
  _paused = true;
}

void MciPlayer::Resume() {
  std::cout << "MciPlayer::Resume id=" << _soundId << "\n";
  _playing = true;
  _paused = false;
}

void MciPlayer::Stop() {
  std::cout << "MciPlayer::Stop id=" << _soundId << "\n";
  _playing = false;
  _paused = false;
}

bool MciPlayer::IsPlaying() const {
  return _playing;
}

}
