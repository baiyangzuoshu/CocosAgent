// Paste into the Creator 3.8.7 demo Web preview DevTools console.
// Read-only snapshot of existing SkeletalAnimation components; run twice after frames advance.
(() => {
    const scene = cc.director.getScene();
    // The Web preview's legacy `cc` namespace exposes this class as
    // SkeletalAnimationComponent in the supplied 3.8.7 editor build.
    const SkeletalAnimationType = cc.SkeletalAnimation || cc.SkeletalAnimationComponent;
    if (!scene || !SkeletalAnimationType) {
        console.error('STAGE8_SKELETAL_38_ERROR', 'Scene or SkeletalAnimation unavailable');
        return;
    }
    const components = scene.getComponentsInChildren(SkeletalAnimationType);
    const rows = components.map((component) => {
        const clip = component.defaultClip;
        const state = clip ? component.getState(clip.name) : null;
        const info = state && state._animInfo;
        return {
            node: component.node.name,
            nodeUuid: component.node.uuid,
            enabledInHierarchy: component.enabledInHierarchy,
            clip: clip && clip.name,
            playOnLoad: component.playOnLoad,
            useBakedAnimation: component.useBakedAnimation,
            state: state && {
                time: state.time,
                duration: state.duration,
                isPlaying: state.isPlaying,
                isPaused: state.isPaused,
                bakedFrame: info && info.data && info.data[0],
            },
            skinnedMeshUsers: component.getUsers().size,
            sockets: component.sockets.length,
        };
    });
    console.log('STAGE8_SKELETAL_38', JSON.stringify({
        clock: 'natural preview snapshot',
        gamePaused: cc.game.isPaused(),
        documentHidden: document.hidden,
        totalFrames: cc.director.getTotalFrames(),
        components: rows,
    }));
})();
