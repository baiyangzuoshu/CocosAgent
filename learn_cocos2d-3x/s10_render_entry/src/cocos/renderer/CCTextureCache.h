#pragma once

#include <map>
#include <memory>
#include <string>

namespace cocos2d {

class Image {
public:
    bool initWithImageFile(const std::string& path) { _path = path; return !path.empty(); }
    const std::string& path() const { return _path; }

private:
    std::string _path;
};

class Texture2D {
public:
    bool initWithImage(const Image& image) { _path = image.path(); return !_path.empty(); }
    const std::string& path() const { return _path; }

private:
    std::string _path;
};

class TextureCache {
public:
    Texture2D* addImage(const std::string& path);

private:
    std::map<std::string, std::unique_ptr<Texture2D>> _textures;
};

} // namespace cocos2d
