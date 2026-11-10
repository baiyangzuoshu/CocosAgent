#include <iostream>
#include <memory>
#include <string>
#include <unordered_map>
#include <utility>

struct Texture
{
    explicit Texture(std::string name) : name(std::move(name)) {}
    std::string name;
};
struct SpriteFrame
{
    SpriteFrame(std::shared_ptr<Texture> texture, int x, int y, int width, int height)
        : texture(std::move(texture)), x(x), y(y), width(width), height(height) {}
    std::shared_ptr<Texture> texture;
    int x;
    int y;
    int width;
    int height;
};
class SpriteFrameCache
{
public:
    void add(std::string name, const std::shared_ptr<Texture>& texture,
             int x, int y, int width, int height)
    {
        frames_[std::move(name)] =
            std::make_shared<SpriteFrame>(texture, x, y, width, height);
    }
    std::shared_ptr<SpriteFrame> get(const std::string& name) const
    {
        const auto found = frames_.find(name);
        return found == frames_.end() ? nullptr : found->second;
    }
    void removeAll() { frames_.clear(); }
    std::size_t size() const { return frames_.size(); }
private:
    std::unordered_map<std::string, std::shared_ptr<SpriteFrame>> frames_;
};
class Sprite
{
public:
    void setSpriteFrame(std::shared_ptr<SpriteFrame> frame)
    {
        frame_ = std::move(frame);
        texture_ = frame_ ? frame_->texture : nullptr;
    }
    void clear()
    {
        frame_.reset();
        texture_.reset();
    }
    bool hasFrame() const { return frame_ != nullptr; }
    bool hasTexture() const { return texture_ != nullptr; }
private:
    std::shared_ptr<SpriteFrame> frame_;
    std::shared_ptr<Texture> texture_;
};
int main()
{
    std::cout << std::boolalpha;
    auto atlas = std::make_shared<Texture>("characters.png");
    std::weak_ptr<Texture> textureLifetime = atlas;
    SpriteFrameCache frames;
    frames.add("hero_idle_0", atlas, 0, 0, 32, 48);
    frames.add("hero_idle_1", atlas, 32, 0, 32, 48);
    Sprite hero;
    hero.setSpriteFrame(frames.get("hero_idle_0"));
    atlas.reset();
    std::cout << "two named frames share one atlas texture: "
              << (frames.get("hero_idle_0")->texture
                  == frames.get("hero_idle_1")->texture) << '\n';
    frames.removeAll();
    std::cout << "frame cache entries after clear: " << frames.size() << '\n';
    std::cout << "Sprite still owns its frame and texture: "
              << hero.hasFrame() << ", " << hero.hasTexture() << '\n';
    std::cout << "texture alive while Sprite keeps the frame: "
              << !textureLifetime.expired() << '\n';
    hero.clear();
    std::cout << "texture expires after the last owner releases it: "
              << textureLifetime.expired() << '\n';
}
