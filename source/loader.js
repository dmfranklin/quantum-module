// Utility function to dynamically load a JavaScript file
const loadJS = (src) => {
  const script = document.createElement("script");
  script.src = src;
  document.head.append(script);
  return new Promise((resolve) => {
    script.onload = () => {
      resolve(script);
    };
  });
};

// Utility function to dynamically load a CSS stylesheet
const loadCSS = (href) => {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = href;
  document.head.append(style);
  return new Promise((resolve) => {
    style.onload = () => {
      resolve(style);
    };
  });
};

// Function to load SPLICE state from the Runestone database
const loadSpliceState = async () => {
  await SPLICE.getState();
};

// Load all required scripts and styles for the interactive widget
const loadEverything = async () => {
  // Load syntax highlighting libraries for optional code input widgets
  await loadCSS(
    "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/default.min.css"
  );
  await loadCSS("https://cdn.jsdelivr.net/npm/prismjs@1.30.0/themes/prism.min.css");
  await loadJS(
    "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js"
  );

  // Load the code-input component used to allow Qiskit-style circuit entry
  await loadCSS("https://cdn.jsdelivr.net/gh/WebCoder49/code-input@2.3/code-input.min.css");
  await loadJS("https://cdn.jsdelivr.net/gh/WebCoder49/code-input@2.3/code-input.min.js");

  // Load Q.js core library and its stylesheets
  const qCommitHash = "f7ef0f8cc92f91344c1c5aba6bfe2c8d106d83f8"; // pinned commit for consistency
  await loadCSS(`https://cdn.jsdelivr.net/gh/stewdio/q.js@${qCommitHash}/build/q.css`);
  await loadCSS(`https://cdn.jsdelivr.net/gh/stewdio/q.js@${qCommitHash}/assets/documentation.css`);
  await loadJS(`https://cdn.jsdelivr.net/gh/stewdio/q.js@${qCommitHash}/build/q.js`);

  // Load SPLICE protocol for submitting scores to Runestone
  await loadJS("http://bean.cs.uchicago.edu:9999/source/splice.js");

  // Load the custom quantum widget code and styles
  // Use local paths for development, CDN for production
  // if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  // Local development
  await loadCSS("http://bean.cs.uchicago.edu:9999/source/widget.css");
  await loadJS("http://bean.cs.uchicago.edu:9999/source/widget.js");
  await loadJS("http://bean.cs.uchicago.edu:9999/source/circuits.js");
  // } else {
  //   // Deployed module (e.g., hosted on Runestone)
  //   await loadCSS("https://cdn.jsdelivr.net/gh/dmfranklin/quantum-module/source/widget.css");
  //   await loadJS("https://cdn.jsdelivr.net/gh/dmfranklin/quantum-module/source/widget.js");
  //   await loadJS("https://cdn.jsdelivr.net/gh/dmfranklin/quantum-module/source/circuits.js");
  // }

  // Load any existing state the student may have in progress
  await loadSpliceState();
};

// Start script/style loading and store the resulting Promise
const widgetReady = loadEverything();

// Hide the script container div
document.currentScript.parentElement.style.display = "none";

// Watch for child script tags added dynamically to this <interactive> container
// Once detected, wait for all required resources to finish loading (via widgetReady)
// Then evaluate the script content, which will call the appropriate widget initializer
new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.parentElement.tagName == "SCRIPT") {
          node.remove(); // Prevent script from executing automatically
          widgetReady.then(() => {
            eval(node.textContent); // Safe to evaluate after dependencies are loaded
          });
        }
      }
    }
  }
}).observe(document.currentScript.parentElement, {
  childList: true,
  subtree: true,
});
