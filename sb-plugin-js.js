// find first line >= toggle click line and doesn't end inside template string
// this is fast but speed isn't that important. Only runs on toggle click
function findSafeLine(text, toggleLineNum) {
  const lines  = text.split(/\r?\n/);
  let checking = false;
  let insideSingle, insideDouble;
  let insideTemplate = false, insideBlock = false;
  for (let curLineNum = 0; curLineNum < lines.length; curLineNum++) {
    let line = lines[curLineNum];
    // combine lines that are split by a backslash
    while(line.slice(-1) === '\\' && curLineNum < lines.length-1)
      line = line.slice(0, -1) + lines[++curLineNum];
    if(curLineNum >= toggleLineNum) checking = true;
    insideSingle = false; 
    insideDouble = false;
    for (let charNum = 0; charNum < line.length; charNum++) {
      const char = line[charNum];
      // check for escaped char
      if(char === '\\') { charNum++; continue; }
      const next2Char = char + line[charNum+1];
      if (insideBlock) {
        if (next2Char === '*/') { insideBlock = false; charNum++; }
        continue;
      }
      if (insideSingle   && char === "'") { insideSingle   = false; continue; }
      if (insideDouble   && char === '"') { insideDouble   = false; continue; }
      if (insideTemplate && char === '`') { insideTemplate = false; continue; }
      // we are outside strings/comments
      // if single-line comment skip rest of line
      if (next2Char === '//') break; 
      // check for start of strings/comments
      if (next2Char === '/*') {
        insideBlock = true;
        charNum++;
        continue;
      }
      if (char === "'") { insideSingle   = true; continue; }
      if (char === '"') { insideDouble   = true; continue; }
      if (char === '`') { insideTemplate = true; continue; }
    }
    // end of line
    if(checking && !insideTemplate) return curLineNum;
  }
  // template string or block comment is open to end of file
  // in either case it is safe to add at end of file
  return lines.length - 1;
}

module.exports = { findSafeLine }
