const Main = imports.ui.main;
const Panel = imports.ui.panel;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const _origAddToPanelBox = Panel.Panel.prototype._addToPanelBox;


const settings = Convenience.getSettings("org.gnome.shell.extensions.order-icons")
let order_arr_left = settings.get_value("order-icons-left").deep_unpack()
let order_arr_center = settings.get_value("order-icons-center").deep_unpack()
let order_arr_right = settings.get_value("order-icons-right").deep_unpack()




function enable() {
  Panel.Panel.prototype._redrawIndicators = _redrawIndicators;
  Panel.Panel.prototype._addToPanelBox = _addToPanelBox;
  Main.panel._redrawIndicators();
  settings.connect('changed::order-icons-left', _ => {
        Main.panel._redrawIndicators()});
  settings.connect('changed::order-icons-center', _ => {
        Main.panel._redrawIndicators()});
  settings.connect('changed::order-icons-right', _ => {
        Main.panel._redrawIndicators()});
}

function disable() {
  Panel.Panel.prototype._redrawIndicators = undefined;
  Panel.Panel.prototype._addToPanelBox = _origAddToPanelBox;
}

async function _redrawIndicators() {
  order_arr_left = settings.get_value("order-icons-left").deep_unpack()
  order_arr_center = settings.get_value("order-icons-center").deep_unpack()
  order_arr_right = settings.get_value("order-icons-right").deep_unpack()
  let posArrs = getPosArr(this.statusArea)
    for (const posArr of posArrs){
        for (let i = 0; i < posArr.length; i++) {
          const role = posArr[i].role;
          const indicator = posArr[i].indicator;
          const position = i;
          const order_name = posArr[i].order_name;
          this.statusArea[role] = indicator;
          const box = posArr[i].box;
          
          waitForId(indicator, role).then(_ => {
            setSettingValues(indicator, role, box)
            box.insert_child_at_index(container, position);
          });
          
          const container = indicator.container;
          container.show();
          const parent = container.get_parent();
          if (parent) {
            parent.remove_actor(container);
          }
          if (indicator.menu) {
            this.menuManager.addMenu(indicator.menu);
          }
          
          const destroyId = indicator.connect('destroy', (emitter) => {
            delete this.statusArea[role];
            emitter.disconnect(destroyId);
          });
          indicator.connect('menu-set', this._onMenuSet.bind(this));
          this._onMenuSet(indicator);
        }
  }
}



function _addToPanelBox(role, indicator, position, box) {
  
  const container = indicator.container;
  container.show();
  const parent = container.get_parent();
  if (parent) {
    parent.remove_actor(container);
  }

  this.statusArea[role] = indicator;
  // not ideal, but due to recent changes in appindicator-extension we have to wait for the ID to become available
  waitForId(indicator, role).then(_ => {
    let position_corr = getRelativePosition(indicator, role, box.name, this.statusArea)
    setSettingValues(indicator, role, box)
    box.insert_child_at_index(container, position_corr ? position_corr : position);
  });
  
  if (indicator.menu) {
    this.menuManager.addMenu(indicator.menu);
  }
  const destroyId = indicator.connect('destroy', (emitter) => {
    delete this.statusArea[role];
    emitter.disconnect(destroyId);
  });
  indicator.connect('menu-set', this._onMenuSet.bind(this));
  this._onMenuSet(indicator);
}

function readFile(path) {
  const test = GLib.file_test(path, GLib.FileTest.IS_REGULAR);
  if (!test) {
    return null;
  }
  const [err, data] = GLib.file_get_contents(path);
  const sData = ByteArray.toString(data).split('\n');
  const retArr = [];
  for (const val of sData) {
    if (!val.includes('=')) {
      continue;
    }
    const tempVal = val.split('=');
    retArr.push(tempVal);
  }
  return retArr;
}


function setSettingValues(indicator, role, box){

    let index = null;
    let index_arr = null;
    let name = getTestName(indicator, role);

    if (box.name == "panelRight"){
        index = getSettingsPosition(name, order_arr_right);
        index_arr = order_arr_right.indexOf(name);
        if (index_arr == -1){
          order_arr_right.splice(index, 0, name);
        }
    }
    if (box.name == "panelCenter"){
        index = getSettingsPosition(name, order_arr_center);
        index_arr = order_arr_center.indexOf(name);
        if (index_arr == -1){
          order_arr_center.splice(index, 0, name);
        }
    }
    if (box.name == "panelLeft"){
        index = getSettingsPosition(name, order_arr_left);
       index_arr = order_arr_left.indexOf(name);
        if (index_arr == -1){
          order_arr_left.splice(index, 0, name);
        }
    }
    
    settings.set_value("order-icons-right", new GLib.Variant('as', order_arr_right))
    settings.set_value("order-icons-center", new GLib.Variant('as', order_arr_center))
    settings.set_value("order-icons-left", new GLib.Variant('as', order_arr_left))
    }


function getRelativePosition(indicator, role, boxName, statusArea){
  const indicatorTestName = getTestName(indicator, role);
  if (boxName == "panelRight")
    order_arr = order_arr_right
  else if(boxName == "panelCenter")
    order_arr = order_arr_center
  else if (boxName == "panelLeft")
    order_arr = order_arr_left
  const indicatorPosition = getSettingsPosition(indicatorTestName, order_arr);

  
  let ctr = 0
  for (const k in statusArea) {
    if (k==role) continue
    if (statusArea[k].get_parent().get_parent() != null && boxName === statusArea[k].get_parent().get_parent().get_name()){
      const toTest = getTestName(statusArea[k], k);
      let setPosition = getSettingsPosition(toTest, order_arr);
      if (setPosition == null) {
        setPosition = 0;
      }
      if (setPosition < indicatorPosition){
        ctr = ctr +1;
        }

    }
  }
  return ctr
}



function getPosArr(statusArea) {
  const posArrLeft = [];
  const posArrMiddle = [];
  const posArrRight = [];

  for (const k in statusArea) {
    let box = statusArea[k].get_parent().get_parent();
    if (box == null) continue
    
    const toTest = getTestName(statusArea[k], k);

    let order_arr = null;
    
    if (box.name == 'panelLeft') {
      order_arr = order_arr_left
    } else if (box.name == 'panelCenter') {
      order_arr = order_arr_center
    } else if (box.name == 'panelRight') {
      order_arr = order_arr_right
    }

    const posObj = {};
    posObj.role = k;
    posObj.indicator = statusArea[k];
    posObj.position = getSettingsPosition(toTest, order_arr);
    posObj.box = box;
    posObj.order_name = toTest;
    
    if (box.name == 'panelLeft') {
      posArrLeft.push(posObj);
    } else if (box.name == 'panelCenter') {
      posArrMiddle.push(posObj);
    } else if (box.name == 'panelRight') {
      posArrRight.push(posObj);
    }
  }
  posArrLeft.sort(sortFun);
  posArrMiddle.sort(sortFun);
  posArrRight.sort(sortFun);

  return [posArrLeft, posArrMiddle, posArrRight];
}


function until(conditionFunction) {
  const poll = resolve => {
    if(conditionFunction()){
        resolve();
        return GLib.G_SOURCE_REMOVE;
        }
    else {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, _ => poll(resolve));
        return GLib.G_SOURCE_REMOVE;
        }
  }

  return new Promise(poll);
}

async function waitForId(indicator, name) {
  if (indicator._indicator && name.startsWith('appindicator-')) {
        await until(_ => indicator._indicator.id != null);
    }
    return true
}


function getTestName(indicator, name) {
  let toTest = name;
  if (indicator._indicator) {
    if (name.startsWith('appindicator-')) {
      if (name.includes('dropbox')) {
        // dropbox needs special treatment because it appends the pid to the id.
        // So we need to use the less appropriate title
        toTest = indicator._indicator.title;
      } else {
        toTest = indicator._indicator.id;
      }
    }
  }
  if (toTest) {
    return toTest;
    }
    else {
      let ret = name.split("/")
      return ret[ret.length-1].replaceAll("_", "-")
    }
}

function getSettingsPosition(name, arr) {
  if (arr == null) {
    return 0;
  }
  let index = arr.indexOf(name);
  return index != -1 ? index : 0;
}


function getFilePosition(name, arr) {
  if (arr == null) {
    return null;
  }
  for (const val of arr) {
    if (name == val[0]) {
      return parseInt(val[1]);
    }
  }
  return null;
}

function sortFun(a, b) {
  if (a.position > b.position) {
    return 1;
  } else if (b.position > a.position) {
    return -1;
  } else if (b.position == a.position) {
    if (a.role > b.role) {
      return 1;
    } else if (b.role > a.role) {
      return -1;
    } else {
      return 1;
    }
  }
}

