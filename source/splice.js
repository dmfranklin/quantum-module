/**
 * Custom SPLICE implementation. The reference implementation at https://cssplice.org/slcp/splice-iframe.js
 * has certain issues and design decisions that don't exactly align with Runestone's implementation
 * of the SPLICE protocol.
 */
let callback = undefined;

if (!("SPLICE" in window)) {
  window.SPLICE = {
    getState: async () => {
      window.parent.postMessage({
        subject: "SPLICE.getState",
      });

      return new Promise((resolve) => {
        if (callback) {
          callback();
        } else {
          callback = resolve;
        }
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
    console.log("Got response to getState!");
    console.log("event data", event?.data);

    if (event?.data) {
      console.log("Saved event data to getStateResult");
      SPLICE.getStateResult = event?.data?.state;
    }

    if (callback) {
      console.log("callback being called");
      callback();
    }
  }
}

window.addEventListener("message", handleMessage);
