getChildren(element) {
  if (!element) {
    // Called when the root items are needed
    return getRootItems();
  } else {
    // Called when expanding a parent item to get its children
    return getChildrenOf(element);
  }
}

getChildren(element) {
  if (!element) {
    // Root level
    return Promise.resolve([
      new vscode.TreeItem('Folder A'),
      new vscode.TreeItem('Folder B'),
    ]);
  } else {
    // If the element is 'Folder A', return its children
    if (element.label === 'Folder A') {
      return Promise.resolve([
        new vscode.TreeItem('File A1'),
        new vscode.TreeItem('File A2'),
      ]);
    }
    return Promise.resolve([]);
  }
}

const item = new vscode.TreeItem('Node');
item.myCustomId = 'abc123';

class MyItem extends vscode.TreeItem {
  constructor(label, customData) {
    super(label);
    this.customData = customData;
  }
}

getChildren(element) {
  if (!element) {
    return [new MyItem('Parent', { id: 1 })];
  } else {
    return [new MyItem('Child of ' + element.label, { parentId: element.customData.id })];
  }
}

// adding a child item with a command

class MyTreeProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    this.tree = [
      new MyTreeItem('Parent', [
        new MyTreeItem('Child A')
      ])
    ];
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) return this.tree;
    return element.children || [];
  }

  // Add new child dynamically

  addChildTo(label, parentLabel) {
    const parent = this.findItem(this.tree, parentLabel);
    if (parent) {
      if (!parent.children) parent.children = [];
      parent.children.push(new MyTreeItem(label));
      this._onDidChangeTreeData.fire(parent); // refresh that branch
    }
  }

  // Helper to find an item by label
  findItem(items, label) {
    for (const item of items) {
      if (item.label === label) return item;
      const found = item.children && this.findItem(item.children, label);
      if (found) return found;
    }
    return null;
  }
}

class MyTreeItem extends vscode.TreeItem {
  constructor(label, children = []) {
    super(label, children.length ? vscode.TreeItemCollapsibleState.Collapsed 
                                 : vscode.TreeItemCollapsibleState.None);
    this.label = label;
    this.children = children;
  }
}

vscode.commands.registerCommand('myExtension.addChild', () => {
  provider.addChildTo('Child B', 'Parent');
});


// find an Item given an item's command.argument

class MyTreeItem extends vscode.TreeItem {
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

this.tree = [
  new MyTreeItem('Parent', 'parent-1', [
    new MyTreeItem('Child A', 'child-a'),
    new MyTreeItem('Child B', 'child-b')
  ])
];

findById(items, id) {
  for (const item of items) {
    if (item.id === id) return item;
    const child = item.children && this.findById(item.children, id);
    if (child) return child;
  }
  return null;
}

vscode.commands.registerCommand('myExtension.onClick', (id) => {
  const item = provider.findById(provider.tree, id);
  if (item) {
    vscode.window.showInformationMessage(`You clicked on ${item.label}`);
  }
});
