#include <iostream>
#include <string>
#include <utility>
#include <vector>

struct RenderCommand
{
    std::string node;
    std::string texture;
    std::string program;
    std::string blend;
};
class Renderer
{
public:
    void addCommand(RenderCommand command)
    {
        commands_.push_back(std::move(command));
    }
    void draw()
    {
        std::size_t batches = 0;
        const RenderCommand* previous = nullptr;
        for (const auto& command : commands_)
        {
            const bool compatible = previous != nullptr
                && previous->texture == command.texture
                && previous->program == command.program
                && previous->blend == command.blend;
            if (!compatible)
                ++batches;
            std::cout << "queued " << command.node << " with "
                      << command.texture << '\n';
            previous = &command;
        }
        std::cout << "commands: " << commands_.size()
                  << ", compatible adjacent groups: " << batches << '\n';
        commands_.clear();
    }
private:
    std::vector<RenderCommand> commands_;
};
int main()
{
    Renderer renderer;
    renderer.addCommand({"background", "scene.png", "sprite", "alpha"});
    renderer.addCommand({"hero", "scene.png", "sprite", "alpha"});
    renderer.addCommand({"effect", "spark.png", "sprite", "alpha"});
    renderer.addCommand({"button", "scene.png", "sprite", "alpha"});
    renderer.draw();
    std::cout << "A queued Sprite command is not itself a GPU draw call.\n";
}
