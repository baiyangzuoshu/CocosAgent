#include "cocos2dx/platform/CCFileUtils.h"

namespace cocos2d {

void CCFileUtils::removeSuffixFromFile(std::string& path) {
    const std::string suffix = "-HD";
    const std::size_t extension = path.find_last_of('.');
    const std::size_t position = path.rfind(suffix);
    if (position != std::string::npos && (extension == std::string::npos || position + suffix.size() == extension)) {
        path.erase(position, suffix.size());
    }
}

std::string CCFileUtils::fullPathFromRelativePath(const char* path) {
    return std::string("Resources/") + path;
}

} // namespace cocos2d
