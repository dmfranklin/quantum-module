/**
 * Custom SPLICE implementation. The reference implementation at https://cssplice.org/slcp/splice-iframe.js
 * has certain issues and design decisions that don't exactly align with Runestone's implementation
 * of the SPLICE protocol.
 */

// https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function generateUUID() { // Public Domain/MIT
  let d = new Date().getTime();
  let d2 = (performance && performance.now && (performance.now() * 1000)) || 0 // Time in microseconds since page-load or 0 if unsupported;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    let r = Math.random() * 16; // random number between 0 and 16
    if (d > 0) { // Use timestamp until depleted
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else { // Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Constant that controls how long we wait before timing out on requests made to the SPLICE backend.
// This is important to adjust when working on the textbook locally without an actual Runestone
// SPLICE backend.
const DEFAULT_TIMEOUT = 1500;

if (!("SPLICE" in window)) {
  window.SPLICE = {
    callbacks: {},
    // getStateResults: {},
    getState: async () => {
      const message_id = generateUUID();

      window.parent.postMessage({
        message_id,
        subject: "SPLICE.getState",
      });

      // This converts the disparate `postMessage`/`handleMessage` architecture into a Promise
      // approach. We save the `resolve` function in our `callbacks` dictionary so that when we
      // eventually get a response, that resolve function can be appropriately called.
      return new Promise((resolve, reject) => {
        SPLICE.callbacks[message_id] = resolve;

        // Our only indicator of failure is a timeout; if the SPLICE backend doesn't exist, we have
        // no way of knowing with the completely separate postMessage/handleMessage system.
        setTimeout(() => {
          // Check if resolve() was called, in which case this callback would be deleted from the
          // callbacks map
          if (SPLICE.callbacks[message_id]) {
            delete SPLICE.callbacks[message_id];

            reject("getState timed out");
          }
        }, 5000);
      });
    },
    reportScoreAndState: (score, state) => {
      window.parent.postMessage({
        subject: "SPLICE.reportScoreAndState",
        score: score,
        state: state,
      });
    },
  };
}

function handleMessage(event) {
  const messageType = event?.data?.subject;
  if (messageType === "SPLICE.getState.response") {
    const message_id = event?.data?.message_id;

    if (message_id && SPLICE.callbacks[message_id]) {
      console.log(`getState returning with message_id ${message_id} and state:`, event?.data?.state);
      SPLICE.callbacks[message_id](event?.data?.state);
      delete SPLICE.callbacks[message_id];
    }
  }
}

window.addEventListener("message", handleMessage);
