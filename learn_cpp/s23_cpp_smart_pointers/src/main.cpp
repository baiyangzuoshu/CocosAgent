#include <iostream>
#include <memory>
#include <string>
#include <utility>

class Resource {
public:
    explicit Resource(const char* name)
        : name_{name}
    {
    }

    ~Resource()
    {
        std::cout << "destroyed: " << name_ << '\n';
    }

    const std::string& name() const
    {
        return name_;
    }

private:
    std::string name_;
};

int main()
{
    std::cout << "unique ownership:\n";
    auto unique_owner = std::make_unique<Resource>("hero");
    std::unique_ptr<Resource> scene_owner{std::move(unique_owner)};
    std::cout << std::boolalpha << "source empty: " << (unique_owner == nullptr) << '\n';
    std::cout << "current owner: " << scene_owner->name() << '\n';
    scene_owner.reset();

    std::cout << "shared ownership:\n";
    auto shared_owner = std::make_shared<Resource>("map");
    std::weak_ptr<Resource> observer{shared_owner};
    {
        auto second_owner = shared_owner;
        if (auto locked_owner = observer.lock()) {
            std::cout << "weak lock sees: " << locked_owner->name() << '\n';
        }
    }

    shared_owner.reset();
    std::cout << "weak expired: " << observer.expired() << '\n';
    return 0;
}
