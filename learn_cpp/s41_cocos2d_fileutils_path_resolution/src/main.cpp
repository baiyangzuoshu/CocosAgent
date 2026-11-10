#include <filesystem>
#include <iostream>
#include <map>
#include <set>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

class FileResolver
{
public:
    void setSearchPaths(std::vector<std::string> paths)
    {
        searchPaths_ = std::move(paths);
        fullPathCache_.clear();
    }
    void setResolutionOrder(std::vector<std::string> resolutions)
    {
        resolutions_ = std::move(resolutions);
        fullPathCache_.clear();
    }
    void setFilenameMapping(std::string logical, std::string physical)
    {
        filenameLookup_[std::move(logical)] = std::move(physical);
        fullPathCache_.clear();
    }
    void addExistingFile(std::string path)
    {
        existingFiles_.insert(std::move(path));
    }
    std::string fullPathForFilename(const std::string& filename)
    {
        if (filename.empty())
            return {};
        if (isAbsolute(filename))
            return filename;
        const auto cached = fullPathCache_.find(filename);
        if (cached != fullPathCache_.end())
            return cached->second;

        const auto mapping = filenameLookup_.find(filename);
        const std::string physical =
            mapping == filenameLookup_.end() ? filename : mapping->second;
        const std::filesystem::path relative{physical};
        const auto parent = relative.parent_path();
        const auto leaf = relative.filename();
        for (const auto& searchPath : searchPaths_)
        {
            for (const auto& resolution : resolutions_)
            {
                auto candidate = std::filesystem::path{searchPath} / parent;
                if (!resolution.empty())
                    candidate /= resolution;
                candidate /= leaf;
                const std::string fullPath = candidate.generic_string();
                std::cout << "candidate: " << fullPath << '\n';
                if (existingFiles_.find(fullPath) != existingFiles_.end())
                {
                    fullPathCache_[filename] = fullPath;
                    return fullPath;
                }
            }
        }
        return {};
    }
    void addSearchPathAtFront(std::string path)
    {
        searchPaths_.insert(searchPaths_.begin(), std::move(path));
        // A previous successful lookup remains cached until explicitly purged.
    }
    void purgeCachedEntries() { fullPathCache_.clear(); }
    bool isFileExist(const std::string& path)
    {
        if (isAbsolute(path))
            return existingFiles_.find(path) != existingFiles_.end();
        return !fullPathForFilename(path).empty();
    }
private:
    static bool isAbsolute(const std::string& path)
    {
        return !path.empty() && path.front() == '/';
    }
    std::vector<std::string> searchPaths_;
    std::vector<std::string> resolutions_;
    std::map<std::string, std::string> filenameLookup_;
    std::set<std::string> existingFiles_;
    std::unordered_map<std::string, std::string> fullPathCache_;
};

int main()
{
    FileResolver files;
    files.setSearchPaths({"themeA", "themeB"});
    files.setResolutionOrder({"resources-hd", ""});
    files.setFilenameMapping("ui/button.png", "ui/button-packed.png");
    files.addExistingFile("themeA/ui/button-packed.png");
    files.addExistingFile("hotfix/ui/button-packed.png");

    const std::string logicalName = "ui/button.png";
    const auto first = files.fullPathForFilename(logicalName);
    std::cout << "resolved: " << first << '\n';
    files.addSearchPathAtFront("hotfix");
    std::cout << "after adding a higher-priority path: "
              << files.fullPathForFilename(logicalName) << '\n';
    files.purgeCachedEntries();
    std::cout << "after purging the path cache: "
              << files.fullPathForFilename(logicalName) << '\n';
    std::cout << "logical resource exists: "
              << std::boolalpha << files.isFileExist(logicalName) << '\n';
}
