#include <iostream>
#include <memory>
#include <string>
#include <utility>

struct GLView
{
    explicit GLView(std::string owner) : createdBy(std::move(owner)) {}
    std::string createdBy;
};

struct Scene
{
    explicit Scene(std::string name) : name(std::move(name)) {}
    std::string name;
};

class Director
{
public:
    GLView* getOpenGLView() const { return view_.get(); }

    void setOpenGLView(std::unique_ptr<GLView> view)
    {
        view_ = std::move(view);
        std::cout << "Director receives GLView from " << view_->createdBy << '\n';
    }

    void configureDisplay()
    {
        std::cout << "set design resolution: 480 x 320\n";
    }

    void runWithScene(std::unique_ptr<Scene> scene)
    {
        std::cout << "runWithScene: " << scene->name << '\n';
        scene_ = std::move(scene);
    }

private:
    std::unique_ptr<GLView> view_;
    std::unique_ptr<Scene> scene_;
};

class AppDelegate
{
public:
    explicit AppDelegate(Director& director) : director_(director) {}

    bool applicationDidFinishLaunching()
    {
        std::cout << "get Director instance\n";
        if (director_.getOpenGLView() == nullptr)
        {
            std::cout << "create GLView in AppDelegate\n";
            director_.setOpenGLView(std::make_unique<GLView>("AppDelegate"));
        }
        else
        {
            std::cout << "reuse platform GLView\n";
        }

        director_.configureDisplay();
        director_.runWithScene(std::make_unique<Scene>("HelloWorld"));
        return true;
    }

private:
    Director& director_;
};

int main(int argc, char** argv)
{
    Director director;
    if (argc > 1 && std::string(argv[1]) == "existing-view")
        director.setOpenGLView(std::make_unique<GLView>("platform"));

    AppDelegate app(director);
    return app.applicationDidFinishLaunching() ? 0 : 1;
}
