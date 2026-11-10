#include <iostream>
#include <memory>
#include <string>
#include <unordered_map>
#include <utility>

struct Texture
{
    explicit Texture(std::string resolvedPath) : path(std::move(resolvedPath)) {}
    std::string path;
};

class TextureCache
{
public:
    Texture* addImage(const std::string& resolvedPath)
    {
        const auto existing = textures_.find(resolvedPath);
        if (existing != textures_.end())
            return existing->second.get();
        auto texture = std::make_shared<Texture>(resolvedPath);
        Texture* result = texture.get();
        textures_.emplace(resolvedPath, std::move(texture));
        return result;
    }
    std::shared_ptr<Texture> retainForSprite(const std::string& resolvedPath) const
    {
        const auto found = textures_.find(resolvedPath);
        return found == textures_.end() ? nullptr : found->second;
    }
    void removeTextureForKey(const std::string& resolvedPath)
    {
        textures_.erase(resolvedPath);
    }
private:
    std::unordered_map<std::string, std::shared_ptr<Texture>> textures_;
};

class Sprite
{
public:
    void setTexture(std::shared_ptr<Texture> texture)
    {
        texture_ = std::move(texture);
    }
    long textureOwners() const
    {
        return texture_ ? texture_.use_count() : 0;
    }
private:
    std::shared_ptr<Texture> texture_;
};

int main()
{
    TextureCache cache;
    const std::string path = "assets/hero.png";
    Texture* first = cache.addImage(path);
    Texture* second = cache.addImage(path);
    std::cout << std::boolalpha
              << "same resolved path reuses the object: " << (first == second) << '\n';
    Sprite sprite;
    sprite.setTexture(cache.retainForSprite(path));
    std::cout << "owners while cached and used by a Sprite: "
              << sprite.textureOwners() << '\n';
    cache.removeTextureForKey(path);
    std::cout << "Sprite still owns the old texture: "
              << (sprite.textureOwners() == 1) << '\n';
    Texture* replacement = cache.addImage(path);
    std::cout << "reload creates a different cached object: "
              << (replacement != first) << '\n';
}
