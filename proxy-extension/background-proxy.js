import * as indexedDB from './modules/indexdb.mjs'

"use strict";

const P = {
  READ: 0x1 << 0,
  WRITE: 0x1 << 1,
}

browser.runtime.onMessageExternal.addListener(async (request, sender) => {
  switch (request.command) {
    case "getVersion":
      {
        const manifest = browser.runtime.getManifest();
        return manifest.version;
      }
    case "readFilePicker":
      {
        let displayPath = await indexedDB.getFolderPath(request.folderId);
        let picker = await browser.FSA.readFilePicker({ displayPath });
        let folderId = await indexedDB.getFolderId(picker.folder.path);
        // The user selected the file and thus gave permission to re-read the same
        // file at a later time (without using the file picker).
        // Note #1: Single one-time read via a file picker does not need the FSA add-on.
        await indexedDB.updatePermissions(P.READ, {
          folderPath: picker.folder.path,
          fileName: picker.file.name,
          extensionId: sender.id
        });
        return {
          file: picker.file,
          folderId,
        };
      }

    case "readFilesPicker":
      {
        let displayPath = await indexedDB.getFolderPath(request.folderId);
        let picker = await browser.FSA.readFilesPicker({ displayPath });
        let folderId = await indexedDB.getFolderId(picker.folder.path);
        for (let file of picker.files) {
          await indexedDB.updatePermissions(P.READ, {
            folderPath: picker.folder.path,
            fileName: file.name,
            extensionId: sender.id
          });
        }
        return {
          files: picker.files,
          folderId,
        };
      }

    case "readFolderPicker":
      {
        let displayPath = await indexedDB.getFolderPath(request.folderId);
        let picker = await browser.FSA.readFolderPicker({ displayPath });
        let folderId = await indexedDB.getFolderId(picker.folder.path);
        // Permissions: TODO
        return {
          folderId
        };
      }

    case "saveFilePicker":
      {
        let displayPath = await indexedDB.getFolderPath(request.folderId);
        let picker = await browser.FSA.saveFilePicker(request.file, { displayPath });
        let folderId = await indexedDB.getFolderId(picker.folder.path);
        await indexedDB.updatePermissions(P.READ | P.WRITE, {
          folderPath: picker.folder.path,
          fileName: picker.file.name,
          extensionId: sender.id
        });
        return {
          fileName: picker.file.name,
          folderId,
        };
      }

    case "readFile":
      {
        // Do we have permissions?
        let folderPath = await indexedDB.getFolderPath(request.folderId);
        if (!folderPath) {
          // Invalid folderId
          return null;
        }
        if (!await indexedDB.hasPermissions(P.READ, {
          folderPath,
          fileName: request.name,
          extensionId: sender.id
        })) {
          // We should either fail or prompt.
          console.log("No permission to read file", request.name)
          return null;
        }
        return browser.FSA.readFile(folderPath, request.name);
      }

    case "writeFile":
      {
        // Do we have permissions?
        let folderPath = await indexedDB.getFolderPath(request.folderId);
        if (!folderPath) {
          // Invalid folderId
          return null;
        }
        if (!await indexedDB.hasPermissions(P.WRITE, {
          folderPath,
          fileName: request.name,
          extensionId: sender.id
        })) {
          // We should either fail or prompt.
          console.log("No permission to write file", request.name)
          return null;
        }
        return browser.FSA.writeFile(folderPath, request.name, request.file);
      }

    default:
      return { error: "Invalid command" }
  }
})
