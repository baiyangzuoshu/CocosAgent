#pragma once

#include <map>
#include <memory>
#include <string>

namespace cocos2d {

class Image {
public:
    bool initWithImageFile(const std::string& path) { _path = path; _width = 128; _height = 64; return !path.empty(); }
    const std::string& path() const { return _path; }
    int width() const { return _width; }
    int height() const { return _height; }

private:
    std::string _path;
    int _width = 0;
    int _height = 0;
};

class Texture2D {
public:
    bool initWithImage(const Image& image) { _path = image.path(); _width = image.width(); _height = image.height(); return !_path.empty(); }
    const std::string& path() const { return _path; }
    int width() const { return _width; }
    int height() const { return _height; }

private:
    std::string _path;
    int _width = 0;
    int _height = 0;
};

class TextureCache {
public:
    Texture2D* addImage(const std::string& path);

private:
    std::map<std::string, std::unique_ptr<Texture2D>> _textures;
};

} // namespace cocos2d
