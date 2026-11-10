#include <iostream>
#include <string>
#include <utility>
#include <vector>

class Ref
{
public:
    void retain() { ++referenceCount_; }

    void release()
    {
        if (--referenceCount_ == 0)
            delete this;
    }

    int referenceCount() const { return referenceCount_; }

protected:
    virtual ~Ref() = default;

private:
    int referenceCount_{1};
};

class AutoreleasePool
{
public:
    void addObject(Ref* object) { objects_.push_back(object); }

    void clear()
    {
        for (auto it = objects_.rbegin(); it != objects_.rend(); ++it)
            (*it)->release();
        objects_.clear();
    }

    ~AutoreleasePool() { clear(); }

private:
    std::vector<Ref*> objects_;
};

class Node final : public Ref
{
public:
    explicit Node(std::string name) : name_(std::move(name)) {}
    ~Node() override { std::cout << "destroy " << name_ << '\n'; }

private:
    std::string name_;
};

class Parent
{
public:
    void addChild(Node* child)
    {
        child->retain();
        child_ = child;
        std::cout << "parent retains child: " << child_->referenceCount() << '\n';
    }

    void removeChild()
    {
        if (child_ != nullptr)
        {
            Node* child = child_;
            child_ = nullptr;
            child->release();
        }
    }

    ~Parent() { removeChild(); }

private:
    Node* child_{nullptr};
};

int main()
{
    AutoreleasePool pool;
    Parent parent;

    auto* child = new Node("Sprite");
    pool.addObject(child);
    std::cout << "after create: " << child->referenceCount() << '\n';
    parent.addChild(child);

    pool.clear();
    std::cout << "after pool clear: " << child->referenceCount() << '\n';
    parent.removeChild();
}
