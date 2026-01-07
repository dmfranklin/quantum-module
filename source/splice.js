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
      return new Promise((resolve) => {
        SPLICE.callbacks[message_id] = resolve;
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
  console.log("Received message!");

  const messageType = event?.data?.subject;
  if (messageType === "SPLICE.getState.response") {
    const message_id = event?.data?.message_id;
    console.log(`Got response to getState with message_id ${message_id}!`);

    if (message_id && SPLICE.callbacks[message_id]) {
      console.log(`callback being called for message_id ${message_id} with state:`, event?.data?.state);
      SPLICE.callbacks[message_id](event?.data?.state);
      delete SPLICE.callbacks[message_id];
    }
  }
}

window.addEventListener("message", handleMessage);
