#include <iostream>
#include <memory>
#include <string>
#include <utility>
#include <vector>

class Node;

class Component
{
public:
    virtual ~Component() = default;
    virtual void onAdd() { std::cout << "component onAdd\n"; }
    virtual void onEnter() { std::cout << "component onEnter\n"; }
    virtual void update(double) { std::cout << "component update\n"; }
    virtual void onExit() { std::cout << "component onExit\n"; }
    virtual void onRemove() { std::cout << "component onRemove\n"; }

    Node* node() const { return node_; }

private:
    friend class Node;
    Node* node_{nullptr};
};

class ProbeComponent final : public Component
{
public:
    explicit ProbeComponent(std::string label) : label_(std::move(label)) {}
    void onAdd() override { std::cout << label_ << ": attached\n"; }
    void onEnter() override { std::cout << label_ << ": node entered\n"; }
    void update(double dt) override
    {
        std::cout << label_ << ": update dt=" << dt << '\n';
    }
    void onExit() override { std::cout << label_ << ": node exited\n"; }
    void onRemove() override { std::cout << label_ << ": component removed\n"; }

private:
    std::string label_;
};

class Node
{
public:
    explicit Node(std::string name) : name_(std::move(name)) {}

    Component* addComponent(std::unique_ptr<Component> component)
    {
        component->node_ = this;
        Component* result = component.get();
        components_.push_back(std::move(component));
        result->onAdd();
        return result;
    }

    void onEnter()
    {
        running_ = true;
        std::cout << name_ << ": node entered\n";
        for (const auto& component : components_)
            component->onEnter();
    }

    void update(double dt)
    {
        if (!running_)
            return;
        for (const auto& component : components_)
            component->update(dt);
    }

    void onExit()
    {
        if (!running_)
            return;
        for (const auto& component : components_)
            component->onExit();
        running_ = false;
        std::cout << name_ << ": node exited\n";
    }

    void removeComponent(Component* target)
    {
        for (auto it = components_.begin(); it != components_.end(); ++it)
        {
            if (it->get() == target)
            {
                target->onRemove();
                target->node_ = nullptr;
                components_.erase(it);
                return;
            }
        }
    }

private:
    std::string name_;
    bool running_{false};
    std::vector<std::unique_ptr<Component>> components_;
};

int main()
{
    Node player("Player");
    player.addComponent(std::make_unique<ProbeComponent>("Movement"));
    player.onEnter();
    player.update(1.0 / 60.0);
    auto* lateComponent = player.addComponent(
        std::make_unique<ProbeComponent>("LateAdded"));
    player.removeComponent(lateComponent);
    player.onExit();
}
