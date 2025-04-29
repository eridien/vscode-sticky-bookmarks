// check for line ending inside a template string

function eolIsSafe(text, lineNumber) {
  const lines       = text.split(/\r?\n/);
  const lastLineNum = lines.length-1;
  if(lineNumber >= lines.length) return false;

  let insideSingle, insideDouble;
  let insideTemplate = false, insideBlock = false;

  for (let lineNum = 0; lineNum <= lastLineNum; lineNum++) {
    let line = lines[lineNum];
    // combine lines that are split by a backslash
    while(line.slice(-1) === '\\' && lineNum < lastLineNum)
      line = line.slice(0, -1) + lines[++lineNum];
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
    if(lineNum == lineNumber) return !insideTemplate;
    if(lineNum  > lineNumber) return false;
  }
  return false; // end of file
}

module.exports = { eolIsSafe }
