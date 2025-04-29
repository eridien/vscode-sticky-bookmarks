// find first line >= toggle click line and doesn't end inside template string
// this is fast but speed isn't that important. Only runs on toggle click
function findSafeLine(text, toggleLineNum) {
  const lines  = text.split(/\r?\n/);
  if(toggleLineNum >= lines.length) return lines.length-1;
  let checking = false;
  let insideSingle, insideDouble;
  let insideTemplate = false, insideBlock = false;
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    let line = lines[lineNumber];
    // combine lines that are split by a backslash
    while(line.slice(-1) === '\\' && lineNumber < lines.length-1)
      line = line.slice(0, -1) + lines[++lineNumber];
    if(lineNumber >= toggleLineNum) checking = true;
    insideSingle = false; 
    insideDouble = false;
    for (let charNum = 0; charNum < line.length; charNum++) {
      const char = line[charNum];
      // skip escaped char
      if(char === '\\') { charNum++; continue; }
      const next2Char = char + (line[charNum+1] ?? '');
      if (insideBlock) {
        if (next2Char === '*/') { insideBlock = false; charNum++; }
        continue;
      }
      if (insideSingle  ) { if(char == "'"){ insideSingle   = false; } continue; }
      if (insideDouble  ) { if(char == '"'){ insideDouble   = false; } continue; }
      if (insideTemplate) { if(char == '`'){ insideTemplate = false; } continue; }
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
    if(checking && !insideTemplate) return lineNumber;
  }
  // end of file
  // template string or block comment is still open
  // in either case it is safe to add token
  return lines.length - 1;
}

module.exports = { findSafeLine }
