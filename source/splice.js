/**
 * The SPLICE team provides a reference implementation of the SPLICE protocol at https://cssplice.org/slcp/splice-iframe.js,
 * but the Runestone server implementation doesn't exactly follow this. So we eschew that and roll
 * our own SPLICE interface that works with Runestone.
 */
if (!('SPLICE' in window)) {
    window.SPLICE = {
        saveScore: (score) => {
            window.parent.postMessage({
                subject: "SPLICE.reportScoreAndState",
                score: score,
                state: {},
            });
        }
    }
}