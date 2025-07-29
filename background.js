"use strict";

const P = {
  READ: 0x1 << 0,
  WRITE: 0x1 << 1,
}

let { gPermissions, gFolders } = await browser.storage.local.get({
  gPermissions: new Map(),
  gFolders: new Map()
})

async function updateStorage() {
  await browser.storage.local.set({ gPermissions, gFolders });
}

async function updateFolderId(path) {
  let folderId = gFolders.get(path);
  if (!folderId) {
    folderId = await browser.FSA.newUID();
  }
  gFolders.set(path, folderId);
  return folderId;
}

async function getFolderPath(folderId) {
  const keys = [];
  for (const [key, value] of gFolders.entries()) {
    if (value === folderId) {
      return key;
    }
  }
  return null;
}
async function updatePermissions(folderPath, fileName, newPermissions) {
  const key = JSON.stringify({ folderPath, fileName });
  let curPermissions = gPermissions.get(key) ?? 0;
  gPermissions.set(key, curPermissions | newPermissions);
}

async function hasPermissions(folderPath, fileName, reqPermissions) {
  const key = JSON.stringify({ folderPath, fileName });
  let curPermissions = gPermissions.get(key) ?? 0;
  return curPermissions & reqPermissions;
}

browser.runtime.onMessageExternal.addListener(async (request, sender) => {
  if (request.command == "getVersion") {
    const manifest = browser.runtime.getManifest();
    return manifest.version;
  }

  switch (request.command) {
    case "readFilePicker":
      {
        let rv = await browser.FSA.readFilePicker(request);
        let folderId = await updateFolderId(rv.folder.path);
        // The user selected the file and thus gave permission to re-read the same
        // file at a later time (without using the file picker).
        // Note #1: Single one-time read via a file picker does not need the FSA add-on.
        await updatePermissions(rv.folder.path, rv.file.name, P.READ);
        await updateStorage();
        return {
          file: rv.file,
          folderId,
        };
      }
    
    case "readFilesPicker":
      {
        let rv = await browser.FSA.readFilesPicker(request);
        let folderId = await updateFolderId(rv.folder.path);
        for (let file of rv.files) {
          updatePermissions(rv.folder.path, file.name, P.READ);
        }
        await updateStorage();
        return {
          files: rv.files,
          folderId,
        };
      }

    case "readFolderPicker":
      {
        let rv = await browser.FSA.readFolderPicker(request);
        let folderId = await updateFolderId(rv.folder.path);
        // Permissions: TODO
        await updateStorage();
        return {
          folderId
        };
      }

    case "saveFilePicker":
      {
        let rv = await browser.FSA.saveFilePicker(request);
        let folderId = await updateFolderId(rv.folder.path);
        await updatePermissions(rv.folder.path, rv.file.name, P.READ | P.WRITE);
        await updateStorage();
        return {
          file: {
            name: rv.file.name
          },
          folderId,
        };
      }

      case "readFile": 
      {
        // Do we have permissions?
        let folderPath = await getFolderPath(request.folderId);
        if (!folderPath) {
          // Invalid folderId
          return null;
        }
        if (!await hasPermissions(folderPath, request.name, P.READ)) {
          // We should either fail or prompt.
          console.log("No permission to read file", request.name)
          return null;
        }
        return null;
        //return browser.FSA.readFile(folderPath, request.name);
      }
    
      case "saveFile": 
      {
        // Do we have permissions?
        let folderPath = await getFolderPath(request.folderId);
        if (!await hasPermissions(folderPath, request.name, P.WRITE)) {
          // We should either fail or prompt.
          console.log("No permission to write file", request.name)
          return null;
        }
        return null;
        //return browser.FSA.writeFile(folderPath, request.file);
      }

    default:
      return { error: "Invalid command" }
  }
})
