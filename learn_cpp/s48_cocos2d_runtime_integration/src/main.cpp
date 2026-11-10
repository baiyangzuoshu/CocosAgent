#include <cmath>
#include <iostream>
#include <memory>
#include <set>
#include <string>
#include <unordered_map>
#include <utility>

class FileUtilsModel
{
public:
    void addResource(std::string path) { resources_.insert(std::move(path)); }
    std::string fullPathForFilename(const std::string& name) const
    {
        return resources_.find(name) != resources_.end()
            ? "Resources/" + name : "";
    }
private:
    std::set<std::string> resources_;
};
struct Texture
{
    explicit Texture(std::string path) : path(std::move(path)) {}
    std::string path;
};
class TextureCacheModel
{
public:
    std::shared_ptr<Texture> addImage(const std::string& fullPath)
    {
        auto found = textures_.find(fullPath);
        if (found != textures_.end())
            return found->second;
        auto texture = std::make_shared<Texture>(fullPath);
        textures_.emplace(fullPath, texture);
        return texture;
    }
private:
    std::unordered_map<std::string, std::shared_ptr<Texture>> textures_;
};
struct SpriteModel
{
    std::shared_ptr<Texture> texture;
    double x{0.0};
    double y{0.0};
};
class SceneModel
{
public:
    explicit SceneModel(std::shared_ptr<Texture> texture)
    {
        hero_.texture = std::move(texture);
    }
    void onMouseDown(double x, double y)
    {
        selected_ = std::abs(x - hero_.x) < 0.5
            && std::abs(y - hero_.y) < 0.5;
        std::cout << (selected_ ? "hero selected\n" : "no hit\n");
    }
    void update(double deltaTime)
    {
        if (selected_)
            hero_.x += 2.0 * deltaTime;
    }
    void render() const
    {
        std::cout << "draw command: Sprite texture=" << hero_.texture->path
                  << ", position=(" << hero_.x << ", " << hero_.y << ")\n";
    }
private:
    SpriteModel hero_;
    bool selected_{false};
};
class DirectorModel
{
public:
    void runWithScene(std::unique_ptr<SceneModel> scene)
    {
        scene_ = std::move(scene);
        std::cout << "Director running first Scene\n";
    }
    SceneModel* scene() const { return scene_.get(); }
    void mainLoop(double deltaTime)
    {
        scene_->update(deltaTime);
        scene_->render();
    }
private:
    std::unique_ptr<SceneModel> scene_;
};
class AppDelegateModel
{
public:
    bool applicationDidFinishLaunching()
    {
        files_.addResource("hero.png");
        const auto fullPath = files_.fullPathForFilename("hero.png");
        if (fullPath.empty())
            return false;
        std::cout << "resolved resource: " << fullPath << '\n';
        auto texture = textures_.addImage(fullPath);
        director_.runWithScene(std::make_unique<SceneModel>(std::move(texture)));
        return true;
    }
    DirectorModel& director() { return director_; }
private:
    FileUtilsModel files_;
    TextureCacheModel textures_;
    DirectorModel director_;
};
int main()
{
    AppDelegateModel app;
    if (!app.applicationDidFinishLaunching())
        return 1;
    app.director().scene()->onMouseDown(0.0, 0.0);
    app.director().mainLoop(0.5);
    app.director().mainLoop(0.5);
}
