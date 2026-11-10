#include "Mixer.h"

#include <iostream>

namespace SDL {

MixChunk* Mix_LoadWAV(const char* filePath) {
  std::cout << "Mix_LoadWAV " << filePath << "\n";
  return new MixChunk(filePath);
}

MixMusic* Mix_LoadMUS(const char* filePath) {
  std::cout << "Mix_LoadMUS " << filePath << "\n";
  return new MixMusic(filePath);
}

int Mix_PlayChannel(int channel, const MixChunk* chunk, int loops) {
  std::cout << "Mix_PlayChannel path=" << chunk->path
            << " channel=" << channel << " loops=" << loops << "\n";
  return channel;
}

int Mix_PlayMusic(const MixMusic* music, int loops) {
  std::cout << "Mix_PlayMusic path=" << music->path << " loops=" << loops << "\n";
  return 0;
}

void Mix_Volume(int channel, int volume) {
  std::cout << "Mix_Volume channel=" << channel << " value=" << volume << "\n";
}

void Mix_VolumeMusic(int volume) {
  std::cout << "Mix_VolumeMusic value=" << volume << "\n";
}

void Mix_HaltChannel(int channel) {
  std::cout << "Mix_HaltChannel channel=" << channel << "\n";
}

void Mix_HaltMusic() {
  std::cout << "Mix_HaltMusic\n";
}

}
