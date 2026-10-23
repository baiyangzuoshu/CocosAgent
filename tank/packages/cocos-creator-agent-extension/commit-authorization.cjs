'use strict';

// The explicit commit tool invocation is the authorization boundary. Risk is
// surfaced to Codex through the command's access level and tool description.
module.exports = function authorizeCommit() {
    return true;
};
