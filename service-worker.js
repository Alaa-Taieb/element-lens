chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;

  chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  chrome.action.setTitle({ tabId: tab.id, title: "Element Lens" });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["picker.js"],
  }).catch((error) => {
    console.warn("Element Lens could not start on this page.", error);
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#a83232" });
    chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    chrome.action.setTitle({
      tabId: tab.id,
      title: "Element Lens is unavailable here. Open a regular webpage and try again.",
    });
  });
});
