const vscode  = require('vscode');
const sidebar = require('./sidebar.js');
const text    = require('./text.js');
const utils   = require('./utils.js');
const {log}   = utils.getLog('cmds');

let context;

function init(contextIn) {
  context = contextIn;
}

async function toggleKeyCmd() {
  log('toggleKeyCmd');
  await text.toggle();
}

async function prevKeyCmd() {
  log('prevKeyCmd');
  await text.scrollToPrevNext(false);
}

async function nextKeyCmd() {
  log('nextKeyCmd');
  await text.scrollToPrevNext(true);
}

async function refreshFileKeyCmd() {
  log('refreshFileKeyCmd');

}

async function refreshAllFilesKeyCmd() {
  log('refreshAllFilesKeyCmd');

}

async function deleteFileKeyCmd() {
  log('deleteFileKeyCmd');

}

async function deleteAllFilesKeyCmd() {
  log('deleteAllFilesKeyCmd');

}

async function hideAllTitleCmd() {
  log('hideAllTitleCmd');
  // sidebar.setTreeViewBusyState(true);
  // sidebar.setTreeViewBusyState(false);
}

async function refreshAllTitleCmd() {
  log('refreshAllTitleCmd');

}

async function deleteAllTitleCmd() {
  log('deleteAllTitleCmd');

}

async function eraseNameItemCmd(item) {
  log('eraseNameItemCmd');

}

async function editNameItemCmd(item) {
  log('editNameItemCmd');

}

async function refreshItemCmd(item) {
  log('refreshItemCmd');
  // if(!document) {
  //   const editor = vscode.window.activeTextEditor;
  //   if (!editor) { log('info', 'refreshFileCmd, No active editor'); return; }
  //   document = editor.document;
  // }

  // // file
  // sidebar.setTreeViewBusyState(true);
  // await utils.runOnAllFilesInFolder(refreshFileCmd);
  // sidebar.setTreeViewBusyState(false);

  // switch (item.type) {
  //   case 'folder':   await deleteAllFilesCmd(item.folderPath); break;
  //   case 'file':     await text.refreshFile(document);          break;
  //   case 'bookmark': await text.delMarkFromLineAndGlobal(
  //                item.mark.document, item.mark.lineNumber); break;
  // }
}

async function deleteItemCmd(item) {
  log('deleteItemCmd');

  // if(!document) {
  //   const editor = vscode.window.activeTextEditor;
  //   if (!editor) { log('info', 'deleteCmd, No active editor'); return; }
  //   document = editor.document;
  // }

  // // folder
  // sidebar.setTreeViewBusyState(true);
  // await utils.runOnAllFilesInFolder(deleteCmd);
  // sidebar.setTreeViewBusyState(false);

  // // file
  // await text.deleteFile(document);

}

async function clickItemCmd(item) {
  log('clickItemCmd');

}

async function clearAllSavedDataCmd() {
  log('clearAllSavedDataCmd');
  for (const key of context.workspaceState.keys()) {
    await context.workspaceState.update(key, undefined);
  }
  for (const key of context.globalState.keys()) {
    await context.globalState.update(key, undefined);
  }
  log('info', 'All Sticky Bookmarks data has been cleared.');
}

async function resetAllKeysCmd() {
  log('resetAllKeysCmd');
  for (const key of context.workspaceState.keys()) 
    await context.workspaceState.update(key, undefined);
  for (const key of context.globalState.keys()) 
    await context.globalState.update(key, undefined);
  log('info', 'Sticky Bookmarks keybindings reset.');
};

let sidebarIsVisible = false;

async function changedSidebarVisiblitiy(visible) {
  if(visible && !sidebarIsVisible) {
    utils.updateSidebar();
  }
  sidebarIsVisible = visible;
  utils.updateSidebar(); 
}

async function changedDocument() {
  utils.updateSidebar();
}

async function changedEditor(editor) {
  if(!editor || !editor.document) {
    return;
  }
  utils.updateSidebar();
}

async function changedVisEditors() {
  utils.updateSidebar();
}  

//bookmark
const changedSelection = utils.debounce(async (event) => {
  const {textEditor} = event;
  text.deleteDecoration();
  await text.refreshFile(textEditor.document);
  utils.updateSidebar(); 
  text.updateGutter();
}, 200);

const changedText = utils.debounce(async (event) => {
  const {document} = event;
  text.deleteDecoration();
  await text.refreshFile(event.document);
  utils.updateSidebar(); 
  text.updateGutter();
}, 200);

module.exports = { init, toggleKeyCmd, prevKeyCmd, nextKeyCmd,
                   refreshFileKeyCmd, refreshAllFilesKeyCmd,
                   deleteFileKeyCmd, deleteAllFilesKeyCmd,
                   hideAllTitleCmd, refreshAllTitleCmd, deleteAllTitleCmd,
                   eraseNameItemCmd, editNameItemCmd,
                   refreshItemCmd, deleteItemCmd, clickItemCmd,
                   clearAllSavedDataCmd, resetAllKeysCmd,
                   changedSidebarVisiblitiy, changedText,
                   changedDocument, changedEditor, 
                   changedVisEditors, changedSelection };

