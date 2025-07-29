/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

// Using a closure to not leak anything but the API to the outside world.
(function (exports) {

  var { XPCOMUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/XPCOMUtils.sys.mjs"
  );

  const lazy = {}
  XPCOMUtils.defineLazyGlobalGetters(lazy, ["File", "FileReader"]);

  async function picker({ displayDirectory, mode, title }) {
    const task = Promise.withResolvers();
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    const win = Services.wm.getMostRecentWindow(null);
    fp.init(win.browsingContext, title, mode);
    if (displayDirectory) {
      fp.displayDirectory = displayDirectory;
    }
    // TODO: Filters (file types)
    fp.open(async rv => {
      if (rv == Ci.nsIFilePicker.returnCancel) {
        task.reject();
      } else {
        switch (mode) {
          case Ci.nsIFilePicker.modeGetFolder:
            {
              task.resolve({
                folder: {
                  name: fp.file.leafName,
                  path: fp.file.path
                }
              });
            }
            break;
          case Ci.nsIFilePicker.modeOpenMultiple:
            {
              let files = [];
              let folder;
              for (let file of fp.files) {
                files.push(await lazy.File.createFromNsIFile(file));
                // We assume that a picker cannot select files from different folders.
                if (!folder) {
                  folder = {
                    name: file.parent.leafName,
                    path: file.parent.path
                  }
                }
              }
              task.resolve({
                files,
                folder
              });
            }
            break;
          case Ci.nsIFilePicker.modeSave:
            {
              console
              task.resolve({
                file: {
                  name: fp.file.leafName,
                  path: fp.file.path
                },
                folder: {
                  name: fp.file.parent.leafName,
                  path: fp.file.parent.path
                }
              });
            }
            break;
          default:
            {
              let file = await lazy.File.createFromNsIFile(fp.file);
              task.resolve({
                file,
                folder: {
                  name: fp.file.parent.leafName,
                  path: fp.file.parent.path
                }
              });
            }
            break;
        }
      }
    })
    return task.promise;
  }

  var FSA = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
      return {
        FSA: {
          newUID() {
            return Services.uuid.generateUUID().toString().substring(1, 37);
          },
          async readFolderPicker(options) {
            return picker({ ...options, mode: Ci.nsIFilePicker.modeGetFolder, title: "<Add-on name>: Select folder" })
          },
          async readFilePicker(options) {
            return picker({ ...options, mode: Ci.nsIFilePicker.modeOpen, title: "<Add-on name>: Select file" })
          },
          async readFilesPicker(options) {
            return picker({ ...options, mode: Ci.nsIFilePicker.modeOpenMultiple, title: "<Add-on name>: Select files" })
          },
          async saveFilePicker(options) {
            const buffer = await options.file.arrayBuffer();
            let rv = await picker({ ...options, mode: Ci.nsIFilePicker.modeSave, title: "<Add-on name>: Save file" })
            await IOUtils.write(rv.file.path, new Uint8Array(buffer));
            return rv;
          },
          async readFile(folderPath, fileName) {
            console.log("todo: read", folderPath, fileName)
          },
          async writeFile(folderPath, fileName, file) {
            console.log("todo: save", folderPath, fileName, file)
          },
        },
      };
    }

    onShutdown(isAppShutdown) {
      if (isAppShutdown) {
        return; // the application gets unloaded anyway
      }
    }
  };
  exports.FSA = FSA;
})(this);