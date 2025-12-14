const bodyEl = document.body;
bodyEl.style.background = "blue";

console.log("Hello from Sarang's widget JS");

// TODO is this the `label` on the interactive or the `xml:id`?
const id = "sarang-exercise-interactive";

console.log("Activity id:", id);

// Injecting buttons etc. into the interactive HTML
const [growButton, reportScoreButton, getStateButton] = ["Grow", "Report Score", "Get State"].map(
  (text) => {
    const button = document.createElement("button");
    button.textContent = text;
    document.currentScript.parentElement.appendChild(button);
    return button;
  }
);
document.currentScript.parentElement.appendChild(document.createElement("br"));
const textFieldId = "interactive-textfield";
const textField = document.createElement("span");

const setTextFieldScore = (_score) => {
  textField.textContent = `Score from database: ${_score}`;
}

textField.id = textFieldId;
textField.style = "color:white";
setTextFieldScore("N/A");
document.currentScript.parentElement.appendChild(textField);


/**
 * Grow button
 */
growButton.addEventListener("click", () => {
  console.log("Clicked on grow button");
  const currentHeight = bodyEl.clientHeight;
  const newHeight = currentHeight + 100;
  bodyEl.style.height = `${newHeight}px`;
  console.log("Changed height to", newHeight);

  window.parent.postMessage(
    {
      subject: "lti.frameResize",
      height: newHeight,
    },
    "*"
  );

  console.log("Done sending LTI message");
});

let score = 0;

/**
 * Reporting score to backend
 */
reportScoreButton.addEventListener("click", () => {
  console.log("About to report score");

  window.parent.postMessage({
    subject: "SPLICE.reportScoreAndState",
    activity_id: id,
    score: 8,
    state: {
      field: "sample value sent by reportScoreAndState",
      score: 8,
    },
  });
});

getStateButton.addEventListener("click", () => {
  console.log("About to get state");

  window.parent.postMessage({
    subject: "SPLICE.getState",
    activity_id: id,
    // state: {},
  });
});

window.addEventListener("message", async (event) => {
  console.log("Received message!");

  const messageType = event?.data?.subject;
  if (messageType === "SPLICE.getState.response") {
    console.log("Got response to getState:"); 
    console.log("event", event?.data);

    const state = event?.data?.state;
    score = state.score;
  
    setTextFieldScore(score);
  }
});
