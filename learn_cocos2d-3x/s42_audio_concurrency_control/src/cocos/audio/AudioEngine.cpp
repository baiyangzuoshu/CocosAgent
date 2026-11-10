#include "cocos/audio/include/AudioEngine.h"
#include "cocos/audio/AudioEngineImpl.h"

#include <algorithm>
#include <iostream>
#include <unordered_map>
#include <vector>

namespace cocos2d {
namespace experimental {
namespace {

struct AudioInfo {
  std::string path;
  std::string profileName;
};

AudioEngineImpl impl;
std::unordered_map<int, AudioInfo> audios;
std::unordered_map<std::string, unsigned int> profileCounts;
const unsigned int kMaxAudioInstances = 8;

void eraseAudio(int audioId) {
  const auto found = audios.find(audioId);
  if (found == audios.end()) return;
  if (!found->second.profileName.empty()) {
    --profileCounts[found->second.profileName];
  }
  audios.erase(found);
}

}

int AudioEngine::play2d(const std::string& path, bool loop, float volume,
                        const AudioProfile* profile) {
  if (path.empty() || audios.size() >= kMaxAudioInstances) return -1;
  std::string profileName;
  if (profile) {
    if (profile->name.empty()) return -1;
    profileName = profile->name;
    if (profile->maxInstances != 0 &&
        profileCounts[profileName] >= profile->maxInstances) {
      std::cout << "AudioProfile limit reached: " << profileName << "\n";
      return -1;
    }
  }

  volume = std::max(0.0f, std::min(1.0f, volume));
  const int audioId = impl.play2d(path, loop, volume);
  audios.emplace(audioId, AudioInfo{path, profileName});
  if (!profileName.empty()) ++profileCounts[profileName];
  return audioId;
}

void AudioEngine::setLoop(int audioId, bool loop) {
  if (audios.count(audioId)) impl.setLoop(audioId, loop);
}

void AudioEngine::setVolume(int audioId, float volume) {
  if (!audios.count(audioId)) return;
  impl.setVolume(audioId, std::max(0.0f, std::min(1.0f, volume)));
}

void AudioEngine::stop(int audioId) {
  if (!audios.count(audioId)) return;
  impl.stop(audioId);
  eraseAudio(audioId);
}

void AudioEngine::stopAll() {
  impl.stopAll();
  audios.clear();
  profileCounts.clear();
}

void AudioEngine::uncache(const std::string& path) {
  std::vector<int> matching;
  for (const auto& entry : audios) {
    if (entry.second.path == path) matching.push_back(entry.first);
  }
  for (int audioId : matching) stop(audioId);
  impl.uncache(path);
}

void AudioEngine::uncacheAll() {
  stopAll();
  impl.uncacheAll();
}

int AudioEngine::activeCount() {
  return static_cast<int>(audios.size());
}

}
}
