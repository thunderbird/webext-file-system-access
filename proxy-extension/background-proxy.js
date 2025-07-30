import * as indexedDB from './modules/indexdb.mjs'

"use strict";

const P = {
  READ: 0x1 << 0,
  WRITE: 0x1 << 1,
}

browser.runtime.onMessageExternal.addListener(async (request, sender) => {
  switch (request.command) {
    case "getVersion": {
      const manifest = browser.runtime.getManifest();
      return manifest.version;
    }

    // case "readFilesWithPicker": {
    //   let displayPath = await indexedDB.getFolderPath(request.defaultFolderId);
    //   let picker = await browser.FSA.readFilesWithPicker({
    //     displayPath,
    //     defaultName: request.defaultFileName,
    //     filters: request.filters,
    //   });
    //   if (!picker) return null;
    //   let folderId = await indexedDB.getFolderId(picker.folder.path);
    //   for (let file of picker.files) {
    //     await indexedDB.updatePermissions(P.READ, {
    //       folderPath: picker.folder.path,
    //       fileName: file.name,
    //       extensionId: sender.id
    //     });
    //   }
    //   return {
    //     files: picker.files,
    //     folderId,
    //   };
    // }

    // case "getFolderWithPicker": {
    //   let displayPath = await indexedDB.getFolderPath(request.defaultFolderId);
    //   let picker = await browser.FSA.getFolderWithPicker({ displayPath });
    //   if (!picker) return null;
    //   let folderId = await indexedDB.getFolderId(picker.folder.path);
    //   // Permissions: TODO
    //   return {
    //     folderId
    //   };
    // }

    case "readFileWithPicker": {
      let displayPath = await indexedDB.getFolderPath(request.defaultFolderId);
      let rv = await browser.FSA.readFileWithPicker({
        displayPath,
        defaultName: request.defaultFileName,
        filters: request.filters,
      });
      if (rv.error) return rv;

      let folderId = await indexedDB.getFolderId(rv.folder.path);
      // The user selected the file and thus gave permission to re-read the same
      // file at a later time (without using the file picker).
      // Note #1: Single one-time read via a file picker does not need the FSA add-on.
      await indexedDB.updatePermissions(P.READ, {
        folderPath: rv.folder.path,
        fileName: rv.file.name,
        extensionId: sender.id
      });
      return {
        file: rv.file,
        folderId,
      };
    }

    case "writeFileWithPicker":
      {
        let displayPath = await indexedDB.getFolderPath(request.defaultFolderId);
        let rv = await browser.FSA.writeFileWithPicker(request.file, {
          displayPath,
          defaultName: request.defaultFileName,
          filters: request.filters,
        });
        if (rv.error) return rv;

        let folderId = await indexedDB.getFolderId(rv.folder.path);
        await indexedDB.updatePermissions(P.READ | P.WRITE, {
          folderPath: rv.folder.path,
          fileName: rv.file.name,
          extensionId: sender.id
        });
        return {
          file: rv.file,
          folderId,
        };
      }

    case "readFile":
      {
        // Do we have permissions?
        let folderPath = await indexedDB.getFolderPath(request.folderId);
        if (!folderPath) {
          return {
            error: `Invalid folderId <${request.folderId}>`
          }
        }
        if (!await indexedDB.hasPermissions(P.READ, {
          folderPath,
          fileName: request.fileName,
          extensionId: sender.id
        })) {
          return {
            error: `Missing READ permission for ${request.folderId} / ${request.fileName}`
          }
        }
        let rv = await browser.FSA.readFile(folderPath, request.fileName);
        return {
          file: rv.file,
          folderId: request.folderId,
        }
      }

    case "writeFile":
      {
        // Do we have permissions?
        let folderPath = await indexedDB.getFolderPath(request.folderId);
        if (!folderPath) {
          return {
            error: `Invalid folderId <${request.folderId}>`
          }
        }
        if (!await indexedDB.hasPermissions(P.WRITE, {
          folderPath,
          fileName: request.fileName,
          extensionId: sender.id
        })) {
          return {
            error: `Missing WRITE permission for ${request.folderId} / ${request.fileName}`
          }
        }
        let rv = await browser.FSA.writeFile(request.file, folderPath, request.fileName);
        return {
          file: rv.file,
          folderId: request.folderId,
        }
      }

    default:
      return { error: "Invalid command" }
  }
})
