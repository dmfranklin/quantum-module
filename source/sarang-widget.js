const bodyEl = document.body;
bodyEl.style.background = "blue";

console.log("Hello from Sarang's widget JS");

const id = "quantumintro__Custom-Circuit-Exercise";

console.log("Activity id:", id);

const [growButton, reportScoreButton, getStateButton] = ["Grow", "Report Score", "Get State"].map(
  (text) => {
    const button = document.createElement("button");
    button.textContent = text;
    document.currentScript.parentElement.appendChild(button);
    return button;
  }
);

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

reportScoreButton.addEventListener("click", () => {
  console.log("About to report score");

  window.parent.postMessage({
    subject: "SPLICE.reportScoreAndState",
    activity_id: id,
    score: 0.8,
    state: {
      field: "sample value 2",
    },
  });
});

getStateButton.addEventListener("click", () => {
  console.log("About to get state");

  window.parent.postMessage({
    subject: "SPLICE.getState",
    activity_id: id,
    state: {},
  });
});

window.addEventListener("message", async (event) => {
  console.log("Received message!");
  console.log("event", event);
});
