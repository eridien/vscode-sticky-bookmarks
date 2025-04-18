const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs').promises;
const {log, start, end}  = getLog('util');

const timers = {};

function init(contextIn) {
  context = contextIn;
  log('utils initialized');
  return {};
}

let comsByLang = [];
function commentsByLang(langId) {
  return comsByLang[langId] ?? ['//', '']
}

let keywordsStore = {};
function keywords() {
  return keywordsStore;
}

function installBookmarksJson(configText) { 
  let configObj;
  try {configObj = JSON.parse(configText)}
  catch(error) {
    logErr(`Error parsing default sticky-bookmarks.json, aborting`, 
            error);
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

async function fileExists(path) {                                      //:bltm;
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
    logErr(`Error reading file ${relativePath}`, error);
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
    logErr(`Error writing ${relativePath}.`, err);
    return false;
  }
  return true;
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
    const endTime = Date.now();
    const duration = endTime - timers[name];
    const line      = `${module}: ${name} ended, ${timeInSecs(duration)}s`;
    outputChannel.appendLine(line);
    console.log(line);
  }
  const log = function(...args) {
    let errFlag    = false;
    let infoFlag   = false;
    let nomodFlag = false;
    if(typeof args[0] == 'string') {
      errFlag    = args[0].includes('err');
      infoFlag   = args[0].includes('info');
      nomodFlag = infoFlag || args[0].includes('nomod');
    }
    if(errFlag || infoFlag) args = args.slice(1);
    const par = args.map(a => 
      typeof a === 'object' ? JSON.stringify(a, null, 2) : a);
    const line = (nomodFlag ? '' : module + ': ') + 
                 (errFlag    ? ' error, ' : '') + par.join(' ')
    outputChannel.appendLine(line);
    if(errFlag) console.error(line);
    else        console.log(line);
    if(infoFlag) vscode.window.showInformationMessage(line);
  }
  return {log, start, end};
}

function logErr(message, event) {
  log('info err', message);
  log('err', event.message);
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

async function readTxt(noComments, ...paths) {
  let text;
  const filePath = path.join(context.extensionPath, ...paths);
  try {
    const fileUri = vscode.Uri.file(filePath);
    const fileBuf = await vscode.workspace.fs.readFile(fileUri);
    text = Buffer.from(fileBuf).toString('utf8');
  }
  catch (e) { 
    log('err', `reading file ${filePath}, ${e.message}`); 
    return null; 
  }
  if(noComments) text = text.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  return text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTextFromDoc(doc, location) {
  try {
    if (!doc || !location) {
      log('err', 'missing document or location');
      return null;
    }
    return doc.getText(location.range);
  } 
  catch (error) {
    log('err', `Failed to get definition text: ${error.message}`);
    return null;
  }
}

async function locationIsEntireFile(location) {
  const document = 
          await vscode.workspace.openTextDocument(location.uri);
  let docStrtNonBlnkLn = 0;
  for(; docStrtNonBlnkLn < document.lineCount; docStrtNonBlnkLn++) {
    const line = document.lineAt(docStrtNonBlnkLn).text.trim();
    if(line.length > 0) break;
  }
  let docEndNonBlnkLn = document.lineCount-1;
  for(; docEndNonBlnkLn >= 0; docEndNonBlnkLn--) {
    const line = document.lineAt(docEndNonBlnkLn).text.trim();
    if(line.length > 0) break;
  }
  const docStartLine = docStrtNonBlnkLn;
  const docEndLine   = docEndNonBlnkLn;
  const locStartLine = location.range.start.line;
  const locEndLine   = location.range.end.line;
  return (locStartLine <= docStartLine         &&
          locEndLine   >= docEndLine           &&
          location.range.start.character == 0  &&
          location.range.end.character   == 0);
}

function getRangeSize(range) {
  return range.end.line - range.start.line;
}

function blkIdFromId(id) {
  return id.split('-').splice(0, 3).join('-');
}

function tailFromId(id) {
  return id.split('-').splice(3).join('-');
}

function pxToNum(px) {
  return +px.replace(/px$/, '');
}

function numToPx(num) {
  return `${num.toFixed(2)}px`;
}

function fnv1aHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString();
}

module.exports = { 
  init, getLog, getTextFromDoc, sleep, getRangeSize,
  locationIsEntireFile, readTxt, blkIdFromId, tailFromId, 
  pxToNum, numToPx, fnv1aHash, loadStickyBookmarksJson, 
  commentsByLang, keywords, fileExists
}
