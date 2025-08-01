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

  // Returns the selected native file object (nsIFile).
  async function picker({ displayPath, mode, filters, defaultName }) {
    const task = Promise.withResolvers();
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    const win = Services.wm.getMostRecentWindow(null);
    fp.init(win.browsingContext, null, mode);

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
          // case Ci.nsIFilePicker.modeGetFolder:
          //   {
          //     task.resolve({
          //       folder: {
          //         name: fp.file.leafName,
          //         path: fp.file.path
          //       }
          //     });
          //   }
          //   break;
          // case Ci.nsIFilePicker.modeOpenMultiple:
          //   {
          //     let files = [];
          //     let folder;
          //     for (let file of fp.files) {
          //       files.push(await lazy.File.createFromNsIFile(file));
          //       // We assume that a picker cannot select files from different folders.
          //       if (!folder) {
          //         folder = {
          //           name: file.parent.leafName,
          //           path: file.parent.path
          //         }
          //       }
          //     }
          //     task.resolve({
          //       files,
          //       folder
          //     });
          //   }
          //   break;
          case Ci.nsIFilePicker.modeSave:
          default: {
            task.resolve(fp.file);
            break;
          }
        }
      }
    })
    return task.promise;
  }

  var FSA = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
      return {
        FSA: {
          confirm(title, msg) {
            const win = Services.wm.getMostRecentWindow(null);
            return Services.prompt.confirm(win, title, msg);
          },
          // async readFilesWithPicker(options) {
          //   return await picker({ ...options, mode: Ci.nsIFilePicker.modeOpenMultiple })
          // },
          async readFileWithPicker(options) {
            let nativePickedFile = await picker({ ...options, mode: Ci.nsIFilePicker.modeOpen });
            if (!nativePickedFile) {
              return {
                error: "Canceled by user"
              };
            }
            return {
              file: await lazy.File.createFromNsIFile(nativePickedFile),
              nativePath: nativePickedFile.path,
              folder: {
                name: nativePickedFile.parent.leafName,
                path: nativePickedFile.parent.path
              }
            }
          },
          async writeFileWithPicker(file, options) {
            let nativePickedFile = await picker({ ...options, mode: Ci.nsIFilePicker.modeSave });
            if (!nativePickedFile) {
              return {
                error: "Canceled by user"
              };
            }

            // Save the data.
            const buffer = await file.arrayBuffer();
            await IOUtils.write(nativePickedFile.path, new Uint8Array(buffer));

            // Read back the saved file.
            let nativeReadBackFile = Cc["@mozilla.org/file/local;1"].createInstance(
              Ci.nsIFile
            );
            nativeReadBackFile.initWithPath(nativePickedFile.path);
            return {
              file: await lazy.File.createFromNsIFile(nativeReadBackFile),
              nativePath: nativeReadBackFile.path,
              folder: {
                name: nativeReadBackFile.parent.leafName,
                path: nativeReadBackFile.parent.path
              }
            }
          },
          async getFolderWithPicker(options) {
            let nativePickedFile = await picker({ ...options, mode: Ci.nsIFilePicker.modeGetFolder });
            if (!nativePickedFile) {
              return {
                error: "Canceled by user"
              };
            }
            return {
              nativePath: nativePickedFile.path,
              folder: {
                name: nativePickedFile.leafName,
                path: nativePickedFile.path
              }
            }
          },


          async readFile(folderPath, fileName) {
            const path = PathUtils.join(folderPath, fileName);
            // Even though IOUtils is the new shiny thing to use, it does not
            // return the type. So we keep using an nsIFile.
            let nativeFile = Cc["@mozilla.org/file/local;1"].createInstance(
              Ci.nsIFile
            );
            nativeFile.initWithPath(path);
            return {
              file: await lazy.File.createFromNsIFile(nativeFile),
              nativePath: nativeFile.path,
              folder: {
                name: nativeFile.parent.leafName,
                path: nativeFile.parent.path
              }
            }
          },
          async writeFile(file, folderPath, fileName) {
            const path = PathUtils.join(folderPath, fileName);
            const buffer = await file.arrayBuffer();
            await IOUtils.write(path, new Uint8Array(buffer));

            // Read back the saved file.
            let nativeFile = Cc["@mozilla.org/file/local;1"].createInstance(
              Ci.nsIFile
            );
            nativeFile.initWithPath(path);
            return {
              file: await lazy.File.createFromNsIFile(nativeFile),
              nativePath: nativeFile.path,
              folder: {
                name: nativeFile.parent.leafName,
                path: nativeFile.parent.path
              }
            }
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