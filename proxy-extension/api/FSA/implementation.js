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

  const FILTERS = {
    "all": Ci.nsIFilePicker.filterAll,
    "html": Ci.nsIFilePicker.filterHTML,
    "text": Ci.nsIFilePicker.filterText,
    "images": Ci.nsIFilePicker.filterImages,
    "xml": Ci.nsIFilePicker.filterXML,
    "audio": Ci.nsIFilePicker.filterAudio,
    "video": Ci.nsIFilePicker.filterVideo,
    "pdf": Ci.nsIFilePicker.filterPDF,
  }

  const lazy = {}
  XPCOMUtils.defineLazyGlobalGetters(lazy, ["File", "FileReader"]);

  async function picker({ displayPath, mode, title, filters, defaultName }) {
    const task = Promise.withResolvers();
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    const win = Services.wm.getMostRecentWindow(null);
    fp.init(win.browsingContext, title, mode);

    // Handle default folder.
    if (displayPath) {
      let displayDirectory = Cc["@mozilla.org/file/local;1"].createInstance(
        Ci.nsIFile
      );
      try {
        displayDirectory.initWithPath(displayPath);
        fp.displayDirectory = displayDirectory;
      } catch {
        // Failed. Move on.
      }
    }

    // Handle filters.
    let validFilters = filters
      ? filters.filter(f => (f.name && f.ext && f.ext.startsWith("*.")) || FILTERS[f.type])
      : []
    if (validFilters.length == 0) {
      fp.appendFilters(Ci.nsIFilePicker.filterAll)
    } else {
      validFilters.forEach(f => f.name && f.ext && f.ext.startsWith("*.")
        ? fp.appendFilter(f.name, f.ext)
        : fp.appendFilters(FILTERS[f.type])
      );
    }

    // Handle default name.
    if (defaultName) {
      fp.defaultString = defaultName;
    }

    fp.open(async rv => {
      if (rv == Ci.nsIFilePicker.returnCancel) {
        task.resolve();
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
          async saveFilePicker(file, options) {
            const buffer = await file.arrayBuffer();
            let rv = await picker({ ...options, mode: Ci.nsIFilePicker.modeSave, title: "<Add-on name>: Save file" })
            if (!rv) {
              return null;
            }
            await IOUtils.write(rv.file.path, new Uint8Array(buffer));
            return rv;
          },
          async readFile(folderPath, fileName) {
            const path = PathUtils.join(folderPath, fileName);
            // Even though IOUtils is the new shiny thing to use, it does not
            // return the type. So we keep using an nsIFile.
            let file = Cc["@mozilla.org/file/local;1"].createInstance(
              Ci.nsIFile
            );
            file.initWithPath(path);
            return lazy.File.createFromNsIFile(file);
          },
          async writeFile(folderPath, fileName, file) {
            const path = PathUtils.join(folderPath, fileName);
            const buffer = await file.arrayBuffer();
            await IOUtils.write(path, new Uint8Array(buffer));
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