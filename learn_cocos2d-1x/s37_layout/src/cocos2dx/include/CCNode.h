#ifndef COURSE_1X_CCNODE_H
#define COURSE_1X_CCNODE_H

namespace cocos2d {

struct CCSize {
  float width;
  float height;
};

struct CCPoint {
  float x;
  float y;
};

class CCNode {
public:
  explicit CCNode(CCSize size) : _contentSize(size), _position{0, 0} {}

  CCSize getContentSize() const { return _contentSize; }
  CCPoint getPosition() const { return _position; }
  void setPosition(CCPoint position) { _position = position; }

private:
  CCSize _contentSize;
  CCPoint _position;
};

class CCMenuItem : public CCNode {
public:
  using CCNode::CCNode;
};

} // namespace cocos2d

#endif
