#include <iostream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

class Node
{
public:
    explicit Node(std::string name) : name_(std::move(name)) {}

    Node& addChild(std::unique_ptr<Node> child)
    {
        child->parent_ = this;
        children_.push_back(std::move(child));
        return *children_.back();
    }

    Node* find(const std::string& name)
    {
        if (name_ == name)
            return this;
        for (auto& child : children_)
        {
            if (Node* result = child->find(name))
                return result;
        }
        return nullptr;
    }

    void print(unsigned depth = 0) const
    {
        std::cout << std::string(depth * 2, ' ') << name_ << '\n';
        for (const auto& child : children_)
            child->print(depth + 1);
    }

    const std::string& name() const { return name_; }
    const Node* parent() const { return parent_; }

private:
    std::string name_;
    Node* parent_{nullptr};
    std::vector<std::unique_ptr<Node>> children_;
};

int main()
{
    auto scene = std::make_unique<Node>("Scene");
    Node& world = scene->addChild(std::make_unique<Node>("World"));
    Node& player = world.addChild(std::make_unique<Node>("Player"));
    player.addChild(std::make_unique<Node>("Weapon"));
    scene->addChild(std::make_unique<Node>("UI"));

    scene->print();
    if (Node* weapon = scene->find("Weapon"))
        std::cout << "Weapon parent: " << weapon->parent()->name() << '\n';
}
