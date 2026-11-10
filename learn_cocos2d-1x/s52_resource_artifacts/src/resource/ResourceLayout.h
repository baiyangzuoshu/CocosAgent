#pragma once

#include <string>

namespace lesson {

inline std::string resolveFromResourceRoot(const std::string& root, const std::string& filename) {
    if (filename.empty() || filename[0] == '/' || filename.find(':') == 1) return filename;
    if (root.empty() || root[root.size() - 1] == '/' || root[root.size() - 1] == '\\') return root + filename;
    return root + "/" + filename;
}

} // namespace lesson
