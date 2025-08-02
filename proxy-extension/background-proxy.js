import * as indexedDB from './modules/indexdb.mjs'

"use strict";

const P = {
  READ: 0x1 << 0,
  WRITE: 0x1 << 1,
}

// TODO:
// * Add access to activity log?

async function checkPermissions(reqPermission, { fileName, folderPath, extensionId }) {
  if (await indexedDB.hasPermissions(reqPermission, {
    fileName,
    folderPath,
    extensionId,
  })) {
    return true;
  }

  // Check if we have root access.
  if (await indexedDB.hasPermissions(reqPermission, {
    fileName: "*",
    folderPath,
    extensionId,
  })) {
    return true;
  }
  return false;
}

async function requestPersistentAccess(
  nativeFilePath,
  { read, write },
  { rootAccess, fileName, folderPath, extensionId }
) {
  // Internally, fileName == "*" is used to reflect persistent root access to a
  // folder. However, we may never request persistent root access via "*" directly,
  // this must be done via rootAccess == true. 
  if (rootAccess) {
    fileName = "*";
  } else if (fileName == "*") {
    throw new Error(`FSA.requestPersistentAccess(): Invalid file name "*"`);
  }

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
    !await checkPermissions(permissions, { fileName, folderPath, extensionId })
  ) {
    const title = browser.i18n.getMessage("permission.prompt.title");
    const message = [
      browser.i18n.getMessage("permission.prompt.line1", [
        info.name,
        labels.join("/"),
        browser.i18n.getMessage(rootAccess ? "permission.target.folder" : "permission.target.file")
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

function isSafeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }

  // Disallow any path separators and null byte.
  if (
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('\0')
  ) {
    return false;
  }

  // Disallow Windows-reserved characters
  const illegalChars = /[:*?"<>|]/;
  if (illegalChars.test(fileName)) {
    return false;
  }

  // Enforce max filename length
  if (fileName.length > 255) {
    return false;
  }

  return true;
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

    case "getFolderWithPicker": {
      let displayPath = await indexedDB.getFolderPath(request.defaultFolderId);
      let fsaFile = await browser.FSA.getFolderWithPicker({
        displayPath
      });
      if (fsaFile.error) return fsaFile;

      await requestPersistentAccess(fsaFile.nativePath, request, {
        rootAccess: true,
        folderPath: fsaFile.folder.path,
        extensionId: sender.id
      })

      return indexedDB.getFolderId(fsaFile.folder.path);
    }

    case "readFileWithPicker": {
      let displayPath = await indexedDB.getFolderPath(request.defaultFolderId);
      let fsaFile = await browser.FSA.readFileWithPicker({
        displayPath,
        defaultName: request.defaultFileName,
        filters: request.filters,
      });
      if (fsaFile.error) return fsaFile;

      await requestPersistentAccess(fsaFile.nativePath, request, {
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

      await requestPersistentAccess(fsaFile.nativePath, request, {
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
      if (!isSafeFileName(request.fileName)) {
        return {
          error: `Invalid filename <${request.fileName}>`
        }
      }
      let folderPath = await indexedDB.getFolderPath(request.folderId);
      if (!folderPath) {
        return {
          error: `Invalid folderId <${request.folderId}>`
        }
      }
      if (!await checkPermissions(P.READ, {
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
      if (!isSafeFileName(request.fileName)) {
        return {
          error: `Invalid filename <${request.fileName}>`
        }
      }
      let folderPath = await indexedDB.getFolderPath(request.folderId);
      if (!folderPath) {
        return {
          error: `Invalid folderId <${request.folderId}>`
        }
      }
      if (!await checkPermissions(P.WRITE, {
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
      if (!isSafeFileName(request.fileName)) {
        return {
          error: `Invalid filename <${request.fileName}>`
        }
      }
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

// Register listener for DB changes.
indexedDB.registerListener(change => {
  console.log("Received changes", change);
})
