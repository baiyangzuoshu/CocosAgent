#include "cocos2dx/include/CCNode.h"

namespace cocos2d {

CCSize CCNode::getContentSize() const { return _contentSize; }
CCPoint CCNode::getAnchorPoint() const { return _anchorPoint; }
CCPoint CCNode::getPosition() const { return _position; }
void CCNode::setContentSize(CCSize size) { _contentSize = size; }
void CCNode::setAnchorPoint(CCPoint anchor) { _anchorPoint = anchor; }
void CCNode::setPosition(CCPoint position) { _position = position; }

} // namespace cocos2d
