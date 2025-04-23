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

const qCommitHash = "f7ef0f8cc92f91344c1c5aba6bfe2c8d106d83f8";

const loadEverything = async () => {
  // styles
  await loadCSS(`https://cdn.jsdelivr.net/gh/stewdio/q.js@${qCommitHash}/build/q.css`)
  await loadCSS(`https://cdn.jsdelivr.net/gh/stewdio/q.js@${qCommitHash}/assets/documentation.css`)
  await loadCSS("../../../source/widget.css");

  // scripts
  await loadJS(`https://cdn.jsdelivr.net/gh/stewdio/q.js@${qCommitHash}/build/q.js`)
  await loadJS("https://cssplice.org/slcp/splice-iframe.js");
  await loadJS("../../../source/widget.js");
  await loadJS("../../../source/circuits.js");
};

const widgetReady = loadEverything();

document.currentScript.parentElement.style.display = "none";
new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.parentElement.tagName == "SCRIPT") {
          node.remove();
          widgetReady.then(() => {
            eval(node.textContent);
          });
        }
      }
    }
  }
}).observe(document.currentScript.parentElement, {
  childList: true,
  subtree: true,
});
