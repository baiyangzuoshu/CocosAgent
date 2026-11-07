#pragma once

#include <string>

namespace cocos2d {

class FileUtils {
public:
    static FileUtils* getInstance();
    std::string fullPathForFilename(const std::string& path) const;
};

} // namespace cocos2d
