const vscode = require('vscode');

function init(contextIn) { 
  context = contextIn;
}

class SidebarProvider {
  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    return Promise.resolve([
      this.createItem('file 1'),
      this.createItem('file 2')
    ]);
  }

  createItem(label) {
    return {
      label,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: 'sticky-bookmarks.itemClick',
        title: 'Item Clicked',
        arguments: [{ label, arg2:{arg21:'arg21'} }]
      }
    };
  }
}

class sideBarItem extends vscode.TreeItem {
  constructor(label, id, children = []) {
    super(label, children.length ? vscode.TreeItemCollapsibleState.Collapsed 
                                 : vscode.TreeItemCollapsibleState.None);
    this.id = id;
    this.children = children;
    this.command = {
      command: 'myExtension.onClick',
      title: 'On Click',
      arguments: [this.id]  // Pass the item's ID to the command
    };
  }
}


  //   const parentItem = markTree[markTree.length - 1];

  // }

  //   mark.label = `${mark.folderPath} - ${mark.fileRelPath} 
  //                 (${mark.lineNumber})`;
  // }
  


//   const folders = marksArray.reduce((acc, mark) => {
//     acc[mark.folderPath] ?? [];
//     acc[mark.folderPath].push(mark);
//     return acc;
//   }



// }

module.exports = { init, SidebarProvider };
