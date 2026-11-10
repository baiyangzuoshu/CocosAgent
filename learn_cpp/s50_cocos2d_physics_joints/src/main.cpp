#include <algorithm>
#include <iostream>
#include <memory>
#include <unordered_map>
#include <utility>
#include <vector>

struct Body
{
    explicit Body(int id) : id(id) {}
    int id;
    std::vector<int> jointIds;
};
struct Joint
{
    int id;
    Body* bodyA;
    Body* bodyB;
    bool collisionEnabled{true};
    bool constraintCreated{false};
};
class PhysicsWorldModel
{
public:
    int addJoint(std::unique_ptr<Joint> joint)
    {
        if (!joint || joint->bodyA == nullptr || joint->bodyB == nullptr
            || joint->bodyA == joint->bodyB)
            return -1;
        const int id = joint->id;
        joint->bodyA->jointIds.push_back(id);
        joint->bodyB->jointIds.push_back(id);
        joints_.emplace(id, std::move(joint));
        pendingAdd_.push_back(id);
        std::cout << "joint " << id << " queued for world update\n";
        return id;
    }
    void update()
    {
        for (const int id : pendingAdd_)
        {
            const auto found = joints_.find(id);
            if (found != joints_.end())
            {
                found->second->constraintCreated = true;
                std::cout << "constraint created for joint " << id << '\n';
            }
        }
        pendingAdd_.clear();
    }
    void setLocked(bool locked) { locked_ = locked; }
    void removeJoint(int id)
    {
        if (locked_)
        {
            pendingRemove_.push_back(id);
            std::cout << "joint " << id
                      << " removal deferred while world is locked\n";
            return;
        }
        destroyJoint(id);
    }
    void processDeferredRemovals()
    {
        locked_ = false;
        for (const int id : pendingRemove_)
            destroyJoint(id);
        pendingRemove_.clear();
    }
    bool hasJoint(int id) const
    {
        return joints_.find(id) != joints_.end();
    }
    bool constraintCreated(int id) const
    {
        const auto found = joints_.find(id);
        return found != joints_.end() && found->second->constraintCreated;
    }
    bool collisionsAllowed(const Body& a, const Body& b) const
    {
        for (const auto& entry : joints_)
        {
            const Joint& joint = *entry.second;
            const bool connectsPair =
                (joint.bodyA == &a && joint.bodyB == &b)
                || (joint.bodyA == &b && joint.bodyB == &a);
            if (connectsPair && !joint.collisionEnabled)
                return false;
        }
        return true;
    }
private:
    void destroyJoint(int id)
    {
        const auto found = joints_.find(id);
        if (found == joints_.end())
            return;
        auto eraseId = [id](Body* body) {
            auto& ids = body->jointIds;
            ids.erase(std::remove(ids.begin(), ids.end(), id), ids.end());
        };
        eraseId(found->second->bodyA);
        eraseId(found->second->bodyB);
        joints_.erase(found);
        std::cout << "joint " << id
                  << " destroyed and detached from both bodies\n";
    }
    bool locked_{false};
    std::unordered_map<int, std::unique_ptr<Joint>> joints_;
    std::vector<int> pendingAdd_;
    std::vector<int> pendingRemove_;
};
int main()
{
    Body arm{1};
    Body base{2};
    Body nearby{3};
    PhysicsWorldModel world;
    auto pin = std::make_unique<Joint>(Joint{7, &arm, &base});
    pin->collisionEnabled = false;
    const int jointId = world.addJoint(std::move(pin));
    std::cout << "backend constraint exists before update: "
              << std::boolalpha << world.constraintCreated(jointId) << '\n';
    world.update();
    std::cout << "connected bodies collide with each other: "
              << world.collisionsAllowed(arm, base) << '\n';
    std::cout << "connected body still collides with another body: "
              << world.collisionsAllowed(arm, nearby) << '\n';
    world.setLocked(true);
    world.removeJoint(jointId);
    std::cout << "joint remains queued for removal: "
              << world.hasJoint(jointId) << '\n';
    world.processDeferredRemovals();
    std::cout << "joint exists after deferred removal: "
              << world.hasJoint(jointId) << '\n';
    std::cout << "arm joint links after removal: " << arm.jointIds.size() << '\n';
}
