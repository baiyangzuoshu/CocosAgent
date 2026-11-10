#include <iostream>
#include <memory>
#include <string>
#include <unordered_map>
#include <utility>

struct AudioClip
{
    explicit AudioClip(std::string path) : path(std::move(path)) {}
    std::string path;
};
struct Voice
{
    std::shared_ptr<AudioClip> clip;
    bool loop;
};
class AudioEngineModel
{
public:
    void preload(const std::string& path)
    {
        const auto existing = clips_.find(path);
        if (existing == clips_.end())
        {
            clips_.emplace(path, std::make_shared<AudioClip>(path));
            std::cout << "loaded clip: " << path << '\n';
        }
        else
        {
            std::cout << "reused clip: " << path << '\n';
        }
    }
    int play2d(const std::string& path, bool loop)
    {
        preload(path);
        const int id = nextId_++;
        voices_.emplace(id, Voice{clips_.at(path), loop});
        std::cout << "play handle=" << id << ", loop=" << std::boolalpha
                  << loop << '\n';
        return id;
    }
    void stop(int id)
    {
        voices_.erase(id);
        std::cout << "stopped handle=" << id << '\n';
    }
    void finishNaturally(int id)
    {
        voices_.erase(id);
        std::cout << "finished handle=" << id << '\n';
    }
    void uncache(const std::string& path)
    {
        clips_.erase(path);
        std::cout << "uncached clip: " << path << '\n';
    }
    std::size_t activeVoices() const { return voices_.size(); }
    std::size_t cachedClips() const { return clips_.size(); }
private:
    int nextId_{1};
    std::unordered_map<std::string, std::shared_ptr<AudioClip>> clips_;
    std::unordered_map<int, Voice> voices_;
};
int main()
{
    AudioEngineModel audio;
    const std::string path = "audio/background.wav";
    audio.preload(path);
    const int music = audio.play2d(path, true);
    const int effect = audio.play2d(path, false);
    std::cout << "voices=" << audio.activeVoices()
              << ", cached clips=" << audio.cachedClips() << '\n';
    audio.stop(effect);
    audio.finishNaturally(music);
    std::cout << "after playback ends: voices=" << audio.activeVoices()
              << ", cached clips=" << audio.cachedClips() << '\n';
    audio.uncache(path);
    std::cout << "after uncache: voices=" << audio.activeVoices()
              << ", cached clips=" << audio.cachedClips() << '\n';
}
