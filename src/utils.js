const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs').promises;
const {log, start, end}  = getLog('util');

let context, sidebarProvider, sidebar;

function initContext(contextIn) {
  context = contextIn;
}

function init(sidebarProviderIn, sidebarIn) {
  sidebarProvider = sidebarProviderIn;
  sidebar         = sidebarIn;
}

function updateSidebar() {
  sidebarProvider._onDidChangeTreeData.fire();
}

async function setBusy(busy) {
   await sidebar.setBusy(busy);
}

const timers = {};

let comsByLang = [];
function commentsByLang(langId) {
  return comsByLang[langId] ?? ['//', '']
}

let keywordsStore = {};
function keywords() {
  return keywordsStore;
}

function getLog(module) {
  const start = function(name) {
    const startTime = Date.now();
    timers[name]    = startTime;
    const line      = `${module}: ${name} started`;
    outputChannel.appendLine(line);
    console.log(line);
  }
  const end = function(name) {
    if(!timers[name]) {
      const line = `${module}: ${name} ended`;
      outputChannel.appendLine(line);
      console.log(line);
      return;
    }
    const endTime  = Date.now();
    const duration = endTime - timers[name];
    const line     = `${module}: ${name} ended, ${timeInSecs(duration)}s`;
    outputChannel.appendLine(line);
    console.log(line);
  }
  const log = function(...args) {
    let errFlag    = false;
    let errMsgFlag = false;
    let infoFlag   = false;
    let nomodFlag  = false;
    if(typeof args[0] == 'string') {
      errFlag    = args[0].includes('err');
      infoFlag   = args[0].includes('info');
      nomodFlag  = args[0].includes('nomod');
      errMsgFlag = args[0].includes('errmsg');
    }
    if(errFlag || infoFlag || nomodFlag || errMsgFlag) args = args.slice(1);
    let errMsg;
    if(errMsgFlag) {
      errMsg  = args[0]?.message;
      args    = args.slice(1); 
      errFlag = true;
    }
    const par = args.map(a => {
      if(getTokenRegEx().test(a)) a = tokenToDigits(a);
      else if(typeof a === 'object') {
        try{ return JSON.stringify(a, null, 2); }
        catch(e) { return JSON.stringify(Object.keys(a)) + e.message }
      }
      else return a;
    });
    const line = (nomodFlag            ? ''         : module + ': ') +
                 (errFlag              ? ' error, ' : ''           ) + 
                 (errMsg !== undefined ? errMsg     : ''           ) + 
                 par.join(' ');
    const infoLine = (errFlag ? ' error, ' : '') + par.join(' ')
    outputChannel.appendLine(line);
    if(errFlag) console.error(line);
    else        console.log(line);
    if(infoFlag) vscode.window.showInformationMessage(infoLine);
  }
  return {log, start, end};
}

function installBookmarksJson(configText) {
  let configObj;
  try {configObj = JSON.parse(configText)}
  catch(error) {
    log('errmsg', error, `Error parsing default sticky-bookmarks.json, aborting`);
    return false;
  }
  comsByLang = configObj.commentsByLangs;
  if(!comsByLang) {
    log('err info', 'No comment settings in sticky-bookmarks.json, aborting');
    return false;
  }
  keywordsStore = configObj.keywords || {};
  end('loadStickyBookmarksJson');
  return true;
}

function getFocusedWorkspaceFolder() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;
  return vscode.workspace.getWorkspaceFolder(editor.document.uri);
}

function getTargetWorkspaceFolder() {
  const focused = getFocusedWorkspaceFolder();
  if (focused) return focused;
  const all = vscode.workspace.workspaceFolders;
  return all && all.length > 0 ? all[0] : null;
}

async function workspaceFilePath(relativePath) {
  const folder = getTargetWorkspaceFolder();
  if (!folder) {
    log("No workspace folder available");
    return false;
  }
  return path.join(folder.uri.fsPath, relativePath);
}

async function fileExists(path) {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(path));
    return true;
  } catch (_err) {
    return false;
  }
}

async function workspaceFileExists(relativePath) {
  const filePath = await workspaceFilePath(relativePath);
  if (!filePath) {
    log('err', `No workspace folder for ${relativePath}`);
    return false;
  }
  return fileExists(filePath);
}

async function readWorkspaceFile(relativePath) {
  const filePath = await workspaceFilePath(relativePath);
  if (!filePath) {
    log('err', `No workspace folder for ${relativePath}`);
    return null;
  }
  let contents = null;
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    log('errmsg', error, `Error reading file ${relativePath}`);
  }
  return contents;
}

async function writeWorkspaceFile(relativePath, textData) {
  const folder    = await getTargetWorkspaceFolder();
  const folderUri = folder.uri;
  const fileUri   = vscode.Uri.joinPath(folderUri, relativePath);
  const encoder   = new TextEncoder();
  const content   = encoder.encode(textData);
  try {
    await vscode.workspace.fs.writeFile(fileUri, content);
  } catch (err) {
    log('errmsg', err, `Error writing ${relativePath}.`);
    return false;
  }
  return true;
}

function getPathsFromWorkspaceFolder(folder) {   
  if(!folder) return null;
  const uri                = folder.uri;
  const folderIndex        = folder.index;
  const folderName         = folder.name;
  const folderFsPath       = uri.fsPath;
  const folderUriPath      = uri.path;
  const wsPaths = {folderIndex, folderName, folderFsPath, folderUriPath};
  return wsPaths;
}

function getPathsFromFileDoc(doc) {
  if(!doc) return null;
  const uri         = doc.uri;
  const fileFsPath  = uri.fsPath;
  const fileName    = path.basename(fileFsPath);
  const fileUriPath = uri.path;
  const filePaths   = {fileFsPath, fileName, fileUriPath};
  const wsFolder    = vscode.workspace.getWorkspaceFolder(uri);
  const inWorkspace = !!wsFolder;
  if(!inWorkspace) {
    filePaths.inWorkspace = false;
    return filePaths;
  }
  else {
    const wsPaths           = getPathsFromWorkspaceFolder(wsFolder);
    const folderUriPath     = wsPaths.folderUriPath;
    const fileRelUriPath    = fileUriPath.slice( folderUriPath.length + 1);
    const relFilePaths      = {inWorkspace, fileRelUriPath};
    Object.assign(filePaths, wsPaths, relFilePaths);
    return filePaths;
  }
}

//:ejcq;
async function getFileLineDisplay(document, lineNumber) {
  const {fileRelUriPath} = getPathsFromFileDoc(document);
  return `File: ${fileRelUriPath}, Line: ${lineNumber.padStart(3, ' ')}`;
}

async function loadStickyBookmarksJson() {
  start('loadStickyBookmarksJson');
  async function readDefaultConfig() {
    const defaultConfig =
                    await readExtensionFile('sticky-bookmarks.json');
    if(defaultConfig === null) {
      log('err info', 'unable to load sticky-bookmarks.json, aborting.');
      return null;
    }
    return defaultConfig.toString('utf8');
  }
  if(!await workspaceFileExists('sticky-bookmarks.json')) {
    log('sticky-bookmarks.json missing, copying default to workspace');
    const defaultConfig = await readDefaultConfig();
    if(defaultConfig === null) return false;
    const writeOk = await writeWorkspaceFile(
                             'sticky-bookmarks.json', defaultConfig);
    if(!writeOk)
      log('err info', 'Ignoring error and using default config.');
    log('installing default config');
    return installBookmarksJson(defaultConfig);
  }
  let fileTxt = await readWorkspaceFile('sticky-bookmarks.json');
  if(fileTxt === null) {
    log('Ignoring error and using default config.');
    fileTxt = await readDefaultConfig();
    if(fileTxt === null) {
      log('error reading config file in extension, aborting');
      return false;
    }
  }
  return installBookmarksJson(fileTxt);
}

const outputChannel =
         vscode.window.createOutputChannel('Sticky Bookmarks');
outputChannel.clear();
outputChannel.show(true);

function timeInSecs(ms) {
  return (ms / 1000).toFixed(2);
}

async function readExtensionFile(filename) {
  const filePath = path.join(context.extensionPath, ".", filename);
  const fileUri = vscode.Uri.file(filePath);
  try {
    return await vscode.workspace.fs.readFile(fileUri);
  } catch (error) {
    log('err', "readExtensionFile Error reading file:", error.message);
    return null;
  }
}

async function deleteLine(document, lineNumber) {
  const line = document.lineAt(lineNumber); 
  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, line.rangeIncludingLineBreak); 
  await vscode.workspace.applyEdit(edit);
}

//:lp79;
async function insertLine(document, lineNumber, lineText) {
  const position = new vscode.Position(lineNumber, 0);
  const edit     = new vscode.WorkspaceEdit();
  edit.insert(document.uri, position, lineText + '\n');
  return await vscode.workspace.applyEdit(edit);
}

async function replaceLine(document, lineNumber, lineText) {
  const line = document.lineAt(lineNumber);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, line.range, lineText);
  return await vscode.workspace.applyEdit(edit);
}

//:obtt;
function getDocument(document) {
    if (document) return document;
    const editor = vscode.window.activeTextEditor;
    return editor ? editor.document : undefined;
}

function debounce(fn, delay = 100) {
  let timeout;
  let pendingResolve;
  return function (...args) {
    return new Promise(resolve => {
      clearTimeout(timeout);
      if (pendingResolve) pendingResolve(undefined); // cancel previous
      pendingResolve = resolve;
      timeout = setTimeout(async () => {
        const result = await fn.apply(this, args);
        resolve(result);
        pendingResolve = null;
      }, delay);
    });
  };
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function invBase4ToNumber(str) {
  const digitMap = {
    '\u200B': 0, // Zero Width Space
    '\u200C': 1, // Zero Width Non-Joiner
    '\u200D': 2, // Zero Width Joiner
    '\u2060': 3  // Word Joiner
  };
  let num = 0;
  for (const char of str) {
    const digit = digitMap[char];
    if (digit === undefined)
      throw new Error('Invalid character in zero-width base-4 string');
    num = num * 4 + digit;
  }
  return num;
}

function numberToInvBase4(num) {
  const zeroWidthDigits = ['\u200B', '\u200C', '\u200D', '\u2060'];
  if (num === 0) return zeroWidthDigits[0];
  let result = '';
  while (num > 0) {
    const digit = num % 4;
    result = zeroWidthDigits[digit] + result;
    num = Math.floor(num / 4);
  }
  return result;
}

let uniqueIdNum = 0;

//:fnrw;
function getUniqueToken(document) {
  const [commLft, commRgt] = commentsByLang(document.languageId);
  return commLft + numberToInvBase4(++uniqueIdNum) + '.' + commRgt;
}

function getUniqueIdStr() {
  return (++uniqueIdNum).toString();
}

//:379a;
function tokenToDigits(token) {
  const map = {
    '\u200B': '0', // Zero Width Space
    '\u200C': '1', // Zero Width Non-Joiner
    '\u200D': '2', // Zero Width Joiner
    '\u2060': '3'  // Word Joiner
  };
  return [...token.slice(0,-1)]
    .map(c => {
      if (!(c in map)) return null;
      return map[c];
    })
    .filter(c => c !== null)
    .join('').padStart(4, '0');
}

//:62tk;
function tokenToStr(token) {
  return token.replaceAll('\u200B', '0')
              .replaceAll('\u200C', '1')
              .replaceAll('\u200D', '2')
              .replaceAll('\u2060', '3')
}

function getTokenRegEx() {
  return new RegExp("[\\u200B\\u200C\\u200D\\u2060]+\\.");
}

function getTokenRegExG() {
  return new RegExp("[\\u200B\\u200C\\u200D\\u2060]+\\.", 'g');
}

async function runOnAllFoldersInWorkspace(func, runOnFiles, runOnBookmarks) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    log('info err', 'No Folders found in workspace'); 
    return; 
  }
  if(runOnFiles) {
    await setBusy(true);
    const funcRes = [];
    for (const folder of folders)
     funcRes.push(await runOnAllFilesInFolder(
                                     func, folder.uri.fsPath, runOnBookmarks));
    await setBusy(false);
    return funcRes;
  }
  else return folders;
}

async function runOnAllFilesInFolder(func, folderFsPath, runOnAllBookmarksInFile) {
  folderFsPath ??= getFocusedWorkspaceFolder()?.uri.fsPath;
  if (!folderFsPath) { 
    log('info err', 'Folder not found in workspace'); 
    return; 
  }
  const folderUri = vscode.Uri.file(folderFsPath);
  const pattern   = new vscode.RelativePattern(folderUri, '**/*');
  const files     = await vscode.workspace
                                .findFiles(pattern, '**/node_modules/**');
  await setBusy(true);
  const funcRes = [];
  for(const file of files) {
    try {
      if(runOnAllBookmarksInFile) 
           funcRes.push(await runOnAllBookmarksInFile(func, file.fsPath));
      else funcRes.push(await func({document, docText, position, lineText, token}));
    } catch(_e) {continue}
  }
  await setBusy(false);
  return funcRes;
}

module.exports = {
  initContext, init, getLog, loadStickyBookmarksJson,
  commentsByLang, keywords, fileExists,
  getUniqueToken, tokenToDigits, getTokenRegEx, getTokenRegExG,
  deleteLine, insertLine, replaceLine, debounce, sleep,
  getPathsFromWorkspaceFolder, getPathsFromFileDoc,
  getFocusedWorkspaceFolder, runOnAllFoldersInWorkspace,
  updateSidebar, getUniqueIdStr, tokenToStr, getDocument
}

