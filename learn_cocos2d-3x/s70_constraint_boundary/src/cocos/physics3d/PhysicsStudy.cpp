#include "PhysicsStudy.h"
namespace cocos2d { void runLesson() { Physics3DWorldStudy world; Physics3DConstraintStudy hinge{"Door","Frame","hinge"}; world.addPhysics3DConstraint(hinge); std::cout << "constraints in world = " << world.constraints.size() << "\n"; world.removePhysics3DConstraint(hinge); std::cout << "constraints after removal = " << world.constraints.size() << "\n"; } }
