'use strict';

module.exports = {
    load () {
        Editor.log('[STAGE12_2] load');
    },

    unload () {
        Editor.log('[STAGE12_2] unload');
    },

    messages: {
        ping () {
            Editor.log('[STAGE12_2] ping');
        },
    },
};
