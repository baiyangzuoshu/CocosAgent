#pragma once

#include <algorithm>
#include <string>
#include <vector>

namespace lesson {

inline std::string firstExistingPath(const std::string& filename,
                                     const std::vector<std::string>& searchPaths,
                                     const std::vector<std::string>& packagedFiles) {
    for (const std::string& root : searchPaths) {
        const std::string candidate = root + "/" + filename;
        if (std::find(packagedFiles.begin(), packagedFiles.end(), candidate) != packagedFiles.end()) {
            return candidate;
        }
    }
    return filename;
}

} // namespace lesson
