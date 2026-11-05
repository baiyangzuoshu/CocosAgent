#pragma once

#include <string>

namespace cocos2d {

class CCFileUtils {
public:
    static void removeSuffixFromFile(std::string& path);
    static std::string fullPathFromRelativePath(const char* path);
};

} // namespace cocos2d
