function applyCommand(command) {
  if (command === "SCROLL_DOWN") {
    window.scrollBy({ top: window.innerHeight * 0.85, behavior: "smooth" });
    return;
  }

  if (command === "SCROLL_UP") {
    window.scrollBy({ top: -window.innerHeight * 0.85, behavior: "smooth" });
    return;
  }

  if (command === "NEXT") {
    history.forward();
    return;
  }

  if (command === "PREV") {
    history.back();
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "gazepilot_command") {
    return;
  }

  const command = message?.payload?.command;
  if (typeof command === "string") {
    applyCommand(command);
  }
});
