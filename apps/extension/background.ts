chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'lifeis-add',
    title: 'Add "%s" to Lifeis Library',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'lifeis-add') return;

  // Store the selected text so popup can read it
  chrome.storage.local.set({ selectedText: info.selectionText ?? '' }, () => {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 500,
      height: 600,
      focused: true,
    });
  });
});
