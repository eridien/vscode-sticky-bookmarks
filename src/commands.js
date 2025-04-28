const vscode            = require('vscode');
const sidebar           = require('./sidebar.js');
const text              = require('./text.js');
const utils             = require('./utils.js');
const {log, start, end} = utils.getLog('cmds');

let context, treeView;

function init(contextIn, treeViewIn) {
  context  = contextIn;
  treeView = treeViewIn;
}

////////////////////////////////  ACTIONS  ////////////////////////////////////

//:cjjr;

////////////////////////////////  COMMANDS  ///////////////////////////////////

async function toggleCmd() {
  log('toggleCmd');
  await text.toggle();
}

async function prevCmd() {
  log('prevCmd');
  await text.scrollToPrevNext(false);
}

async function nextCmd() {
  log('nextCmd');
  await text.scrollToPrevNext(true);
}

async function hideCmd() {
  log('hideCmd');
  
}

async function expandCmd() {
  log('expandCmd');

}

async function refreshCmd() {
  log('refreshCmd');
  await text.refreshMenu();
}

async function deleteMenuCmd() {
  log('deleteMenuCmd');

}

async function deleteIconCmd(item) {
  log('deleteIconCmd');
  if(item === undefined) {
    item = treeView.selection[0];
    if (!item) { log('info err', 'No Bookmark Selected For Deletion'); return; }
  }
  
  ///////// TODO /////////
  
  // switch (item.type) {
  //   case 'folder':   await utils.runOnAllFilesInFolder(hideCmd); break;
  //   case 'file':     await utils.runOnAllFilesInFolder(hideCmd); break;
  //   case 'bookmark': await text.delMarkFromLineAndGlobal(
  //                       item.mark.document, item.mark.lineNumber); break;
  // }
}

async function nameCmd(item) {
  log('nameCmd');

}

async function eraseCmd(item) {
  log('eraseCmd');

}

async function gotoCmd(item) {
  log('gotoCmd');
  await sidebar.goto(item);
}

async function clearAllSavedDataCmd() {
  log('clearAllSavedDataCmd');

  ///////// TODO /////////

  log('info', 'All Sticky Bookmarks data has been cleared.');
}

async function resetAllKeysCmd() {
  log('resetAllKeysCmd');
  for (const key of context.workspaceState.keys()) 
    await context.workspaceState.update(key, undefined);
  for (const key of context.globalState.keys()) 
    await context.globalState.update(key, undefined);
  log('info', 'Sticky Bookmarks keybindings reset.');
}

async function refreshWorkspaceKeyCmd() {
  log('refreshWorkspaceKeyCmd');

}

async function hideCmd() {
  log('hideCmd');

}

async function refreshAllTitleCmd() {
  log('refreshAllTitleCmd');

}

async function deleteAllTitleCmd() {
  log('deleteAllTitleCmd');

}

async function eraseCmd(item) {
  log('eraseCmd');

}

async function nameCmd(item) {
  log('nameCmd');

}

////////////////////////////////  HELPERS  //////////////////////////////////

//:cx05;
////////////////////////////////  CALLBACKS  //////////////////////////////////
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
  text.clearDecoration();
  //:c626;
  await text.refreshFile(textEditor.document);
  utils.updateSidebar(); 
  text.updateGutter();
}, 200);

const changedText = utils.debounce(async (event) => {
  const {document} = event;
  text.clearDecoration();
  await text.refreshFile(event.document);
  utils.updateSidebar(); 
  text.updateGutter();
}, 200);

module.exports = { init, toggleCmd, prevCmd, nextCmd, 
                   hideCmd, refreshCmd, expandCmd, deleteMenuCmd, 
                   gotoCmd, nameCmd, eraseCmd, deleteIconCmd,
                   clearAllSavedDataCmd, resetAllKeysCmd,
                   changedSidebarVisiblitiy, changedText,
                   changedDocument, changedEditor, 
                   changedVisEditors, changedSelection };

