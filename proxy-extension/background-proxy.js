import * as indexedDB from './modules/indexdb.mjs'

"use strict";

const P = {
  READ: 0x1 << 0,
  WRITE: 0x1 << 1,
}

// TODO:
// * Add access to activity log?

async function requestPersistentAccess(
  nativeFilePath,
  { read, write },
  { fileName, folderPath, extensionId }
) {
  let info = await browser.management.get(extensionId);

  let permissions = 0
  let labels = [];
  if (read) {
    permissions |= P.READ;
    labels.push(browser.i18n.getMessage("permission.read.label"))
  }
  if (write) {
    permissions |= P.WRITE;
    labels.push(browser.i18n.getMessage("permission.write.label"))
  }

  if (
    permissions &&
    !await indexedDB.hasPermissions(permissions, { fileName, folderPath, extensionId })
  ) {
    const title = browser.i18n.getMessage("permission.prompt.title");
    const message = [
      browser.i18n.getMessage("permission.prompt.line1", [
        info.name, labels.join("/")
      ]),
      ``,
      `  ${nativeFilePath}`,
      ``,
      browser.i18n.getMessage("permission.prompt.line2", [
        browser.i18n.getMessage("extensionName")
      ]),
    ].join("\n");
    let granted = await browser.FSA.confirm(title, message);
    if (granted) {
      await indexedDB.updatePermissions(permissions, { fileName, folderPath, extensionId });
    }
  }
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
      let fsaFile = await browser.FSA.readFileWithPicker({
        displayPath,
        defaultName: request.defaultFileName,
        filters: request.filters,
      });
      if (fsaFile.error) return fsaFile;

      await requestPersistentAccess(fsaFile.path, request, {
        fileName: fsaFile.file.name,
        folderPath: fsaFile.folder.path,
        extensionId: sender.id
      })

      return {
        file: fsaFile.file,
        folderId: await indexedDB.getFolderId(fsaFile.folder.path),
      };
    }

    case "writeFileWithPicker": {
      let displayPath = await indexedDB.getFolderPath(request.defaultFolderId);
      let fsaFile = await browser.FSA.writeFileWithPicker(request.file, {
        displayPath,
        defaultName: request.defaultFileName,
        filters: request.filters,
      });
      if (fsaFile.error) return fsaFile;

      await requestPersistentAccess(fsaFile.path, request, {
        fileName: fsaFile.file.name,
        folderPath: fsaFile.folder.path,
        extensionId: sender.id
      })

      return {
        file: fsaFile.file,
        folderId: await indexedDB.getFolderId(fsaFile.folder.path),
      };
    }

    case "readFile": {
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

    case "writeFile": {
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

    case "getPermissions": {
      let folderPath = await indexedDB.getFolderPath(request.folderId);
      if (!folderPath) {
        return {
          error: `Invalid folderId <${request.folderId}>`
        }
      }
      let rv = await indexedDB.getPermissions({
        folderPath,
        fileName: request.fileName,
        extensionId: sender.id
      })
      return {
        read: !!(rv & P.READ),
        write: !!(rv & P.WRITE)
      }
    }

    default:
      return { error: "Invalid command" }
  }
})

// Revoke permissions for removed extensions.
browser.management.onUninstalled.addListener(info => indexedDB.removePermissionsForExtension(info.id));
