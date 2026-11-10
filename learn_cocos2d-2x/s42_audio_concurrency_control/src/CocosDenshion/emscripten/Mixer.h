#pragma once

#include <string>
#include <utility>

namespace SDL {

struct MixChunk {
  explicit MixChunk(std::string source) : path(std::move(source)) {}
  std::string path;
};

struct MixMusic {
  explicit MixMusic(std::string source) : path(std::move(source)) {}
  std::string path;
};

MixChunk* Mix_LoadWAV(const char* filePath);
MixMusic* Mix_LoadMUS(const char* filePath);
int Mix_PlayChannel(int channel, const MixChunk* chunk, int loops);
int Mix_PlayMusic(const MixMusic* music, int loops);
void Mix_Volume(int channel, int volume);
void Mix_VolumeMusic(int volume);
void Mix_HaltChannel(int channel);
void Mix_HaltMusic();

}
