#pragma once

#include "cocos2dx/cocoa/CCObject.h"
#include "cocos2dx/include/CCGeometry.h"

#include <string>
#include <vector>

namespace cocos2d {

class CCNode : public CCObject {
public:
    static CCNode* create();
    void addChild(CCNode* child);
    void removeChild(CCNode* child);
    CCNode* getParent() const;
    const std::vector<CCNode*>& getChildren() const;
    void setTag(int tag);
    int getTag() const;
    void setPosition(float x, float y);
    void setPosition(const CCPoint& position);
    const CCPoint& getPosition() const;


protected:
    CCNode();
    ~CCNode() override;

private:
    void setParent(CCNode* parent);
    CCNode* _parent;
    std::vector<CCNode*> _children;
    int _tag;
    CCPoint _position;

};

} // namespace cocos2d
