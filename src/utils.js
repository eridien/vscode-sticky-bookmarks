const vscode = require('vscode');
const path   = require('path');
const {log}  = getLog('util');

let context;
const timers = {};

function init(contextIn) {
  context = contextIn;
  // log('utils initialized');
  return {};
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
                 (errFlag    ? ' ERROR, ' : '') + par.join(' ')
    outputChannel.appendLine(line);
    if(errFlag) console.error(line);
    else        console.log(line);
    if(infoFlag) vscode.window.showInformationMessage(line);
  }
  return {log, start, end};
}

async function readDirByRelPath(...fileRelPath) {
  const dirPath = path.join(context.extensionPath, ".", ...fileRelPath);
  const dirUri = vscode.Uri.file(dirPath);
  try {
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    const files = entries
      .filter(([, type]) => type === vscode.FileType.File)
      .map(([name]) => name);
    return files;
  } catch (error) {
    log('err', "readDirByRelPath Error reading directory:", error.message);
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

function containsRange(outerRange, innerRange) {
  if((innerRange.start.line < outerRange.start.line) ||
     (innerRange.end.line   > outerRange.end.line)) 
    return false;
  if((innerRange.start.line == outerRange.start.line) &&
     (innerRange.start.character < outerRange.start.character))
    return false;
  if((innerRange.end.line == outerRange.end.line) &&
     (innerRange.end.character > outerRange.end.character))
    return false;
  return true;
}

function rangeContainsPos(range, pos) {
  if((pos.line < range.start.line) ||
     (pos.line > range.end.line)) 
    return false;
  if((pos.line == range.start.line) &&
     (pos.character < range.start.character))
    return false;
  if((pos.line == range.end.line) &&
     (pos.character > range.end.character))
    return false;
  return true;
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

function containsLocation(outerLocation, innerLocation) {
  if(outerLocation.uri.toString() !== 
     innerLocation.uri.toString()) return false;
  return containsRange(outerLocation.range, innerLocation.range);
}

function getRangeSize(range) {
  return range.end.line - range.start.line;
}

function fixDriveLetter(windowsPath) {
  const match = /^\/([a-zA-Z]):\/(.*?)$/.exec(windowsPath);
  if(match) windowsPath = 
                `/${match[1].toUpperCase()}:/${match[2]}`;
  return windowsPath;
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

const commentsByLangs = [
  [['python', 'ruby', 'perl', 'shell (bash, zsh, sh)', 'makefile', 'r', 
    'julia', 'yaml', 'toml', 'elixir', 'nim', 'crystal', 'coffeescript', 
    'dockerfile', 'gnuplot', 'matlab', 'octave'],
                                      ['#',  '']],
  [['haskell', 'lua', 'ada', 'sql'],  ['--', '']],
  [['matlab', 'tex', 'latex', 'erlang', 'prolog', 'lilypond', 'gap'],
                                      ['%',  '']],
  [['ocaml', 'f#', 'pascal', 'delphi', 'sml', 'reasonml', 'mathematica'],
                                      ['\\(\\*', '\\*\\)']],
  [['html'],                          ['<!--', '-->']],
]

const comsByLang = {};
for(const [langs, comments] of commentsByLangs) {
  for(const lang of langs) {
    comsByLang[lang] = comments;
  }
}

function commentsByLang(langId) {return comsByLang[langId] ?? ['//', '']}

function fnv1aHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString();
}

module.exports = { 
  init, getLog, getTextFromDoc, fixDriveLetter, sleep, commentsByLang,
  rangeContainsPos, containsRange, containsLocation, locationIsEntireFile, getRangeSize, 
  readTxt, blkIdFromId, tailFromId, readDirByRelPath, pxToNum, numToPx, fnv1aHash,
  containsLocation
};
