const dbName = "FSA";
const LISTENERS = [];

export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create permissions object store.
            let permissionsStore;
            if (!db.objectStoreNames.contains("permissions")) {
                permissionsStore = db.createObjectStore("permissions", { keyPath: "id", autoIncrement: true });
            } else {
                permissionsStore = event.target.transaction.objectStore("permissions");
            }
            // Create composite permission index.
            if (!permissionsStore.indexNames.contains("permissionIndex")) {
                permissionsStore.createIndex("permissionIndex", ["extensionId", "folderPath", "fileName"], { unique: true });
            }
            // Create an index for extensionIds
            if (!permissionsStore.indexNames.contains("extensionIdIndex")) {
                permissionsStore.createIndex("extensionIdIndex", "extensionId", { unique: false });
            }

            // Create folders object store.
            let foldersStore;
            if (!db.objectStoreNames.contains("folders")) {
                foldersStore = db.createObjectStore("folders", { keyPath: "folderId" });
            } else {
                foldersStore = event.target.transaction.objectStore("folders");
            }
            // Create an index to lookup paths, enforce unique paths.
            if (!foldersStore.indexNames.contains("pathIndex")) {
                foldersStore.createIndex("pathIndex", "folderPath", { unique: true });
            }
        };
    });
}

async function notifyListeners(change) {
    for (let listener of LISTENERS) {
        listener(change);
    }
}

export function registerListener(listener) {
    LISTENERS.push(listener);
}

/**
 * Retrieve all permission records, sorted by extensionId using an index.
 *
 * @returns {Promise<Array>} A promise that resolves to a sorted array of permission records.
 */
export async function getAllPermissionsSorted() {
    const { promise, resolve, reject } = Promise.withResolvers();

    const db = await openDB();
    const tx = db.transaction("permissions", "readonly");
    const store = tx.objectStore("permissions");
    const index = store.index("extensionIdIndex");

    const getReq = index.getAll();

    let result = null;
    getReq.onsuccess = () => {
        result = getReq.result || []
    };

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    return promise;
}

/**
 * Check if the user has granted the requested permissions for the given item.
 *
 * @param {integer} reqPermission - The permissions to check.
 * @param {Object} item - An object that has extensionId, folderPath, fileName.
 * @returns {Promise<Boolean>} Whether the requested permissions were granted or not.
 */
export async function hasPermissions(reqPermission, item) {
    let grantedPermissions = await getPermissions(item);
    return (grantedPermissions & reqPermission) === reqPermission;
}

/**
 * Get the granted permissions for the given item.
 *
 * @param {Object} item - An object that has extensionId, folderPath, fileName.
 * @returns {Promise<Intger>} The granted permissions.
 */
export async function getPermissions(item) {
    const { promise, resolve, reject } = Promise.withResolvers();

    const db = await openDB();
    const tx = db.transaction("permissions", "readwrite");
    const store = tx.objectStore("permissions");
    const index = store.index("permissionIndex");

    const key = [item.extensionId, item.folderPath, item.fileName];
    const getReq = index.get(key);

    let grantedPermissions = 0;
    getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
            grantedPermissions = record.permissions;
        }
    };

    tx.oncomplete = () => resolve(grantedPermissions);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    return promise;
}

/**
 * Add or update the granted permissions for the given item.
 *
 * @param {integer} newPermissions - The permissions to be stored.
 * @param {Object} item - An object that has extensionId, folderPath, fileName.
 * @returns {Promise<Object>} The record that was written to the DB.
 */
export async function updatePermissions(newPermissions, item) {
    const { promise, resolve, reject } = Promise.withResolvers();

    const db = await openDB();
    const tx = db.transaction("permissions", "readwrite");
    const store = tx.objectStore("permissions");
    const index = store.index("permissionIndex");

    const key = [item.extensionId, item.folderPath, item.fileName];
    const getReq = index.get(key);

    let action;
    let savedRecord;
    getReq.onsuccess = () => {
        const record = getReq.result;

        if (record) {
            action = "updated"
            record.permissions = newPermissions;
            // Same primary key (id) = update.
            store.put(record);
            savedRecord = record;
        } else {
            action = "added"
            const newRecord = {
                extensionId: item.extensionId,
                folderPath: item.folderPath,
                fileName: item.fileName,
                permissions: newPermissions
                // No id = autoIncrement will create one.
            };
            const addReq = store.add(newRecord);
            addReq.onsuccess = () => {
                // Capture generated id.
                newRecord.id = addReq.result;
                savedRecord = newRecord;
            };
        }
    };

    tx.oncomplete = () => resolve(savedRecord);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    let rv = await promise;
    await notifyListeners({ action, item, permissions: savedRecord.permissions });
    return rv;
}

/**
 * Remove the granted permissions for the given item.
 *
 * @param {Object} item - An object that has extensionId, folderPath, fileName.
 */
export async function removePermissions(item) {
    const { promise, resolve, reject } = Promise.withResolvers();

    const db = await openDB();
    const tx = db.transaction("permissions", "readwrite");
    const store = tx.objectStore("permissions");
    const index = store.index("permissionIndex");

    const key = [item.extensionId, item.folderPath, item.fileName];
    const getReq = index.get(key);

    let removedRecord;
    getReq.onsuccess = () => {
        removedRecord = getReq.result;
        if (removedRecord) {
            store.delete(removedRecord.id);
        }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    let rv = await promise;
    if (removedRecord) {
        await notifyListeners({ action: "revoked", item });
    }
    return rv;
}

export async function removePermissionsForExtension(extensionId) {
    const { promise, resolve, reject } = Promise.withResolvers();

    const db = await openDB();
    const tx = db.transaction("permissions", "readwrite");
    const store = tx.objectStore("permissions");
    const index = store.index("extensionIdIndex");

    const request = index.openCursor(IDBKeyRange.only(extensionId));

    request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
            cursor.delete();
            cursor.continue();
        }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    let rv = await promise;
    await notifyListeners({ action: "revokedAllForExtension", extensionId });
    return rv;
}

// export async function addItem(item, storeName) {
//     const { promise, resolve, reject } = Promise.withResolvers();

//     const db = await openDB();
//     const tx = db.transaction(storeName, "readwrite");
//     const store = tx.objectStore(storeName);
//     const request = store.add(item);
//     tx.oncomplete = () => resolve(request.result);
//     tx.onerror = () => reject(tx.error);
//     tx.onabort = () => reject(tx.error);
//     return promise;
// }

/**
 * Lookup a folderId by its folderPath.
 *
 * If the path already exists in the database, its associated folderId is returned.
 * If the path does not exist, a new folderId is generated, stored, and returned.
 *
 * @param {string} folderPath - The full path of the folder to look up or insert.
 * @returns {Promise<string>} A promise that resolves with the folderId.
 */
export async function getFolderId(folderPath) {
    const db = await openDB();
    const tx = db.transaction("folders", "readwrite");
    const store = tx.objectStore("folders");
    const pathIndex = store.index("pathIndex");

    const { promise, resolve, reject } = Promise.withResolvers();

    let folderId = null;

    const getReq = pathIndex.get(folderPath);
    getReq.onsuccess = () => {
        const existing = getReq.result;

        if (existing) {
            folderId = existing.folderId;
        } else {
            const item = {
                folderId: crypto.randomUUID(),
                folderPath
            };
            store.add(item);
            folderId = item.folderId;
        }
    };

    tx.oncomplete = () => resolve(folderId);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    return promise;
}

/**
 * Lookup a folderPath by its folderId.
 *
 * @param {string} folderId - The folderId of the folder.
 * @returns {Promise<string|null>} The folderPath, or null if not found.
 */
export async function getFolderPath(folderId) {
    if (!folderId) {
        return null;
    }

    const db = await openDB();
    const tx = db.transaction("folders", "readonly");
    const store = tx.objectStore("folders");

    const { promise, resolve, reject } = Promise.withResolvers();

    const request = store.get(folderId);

    let folderPath = null;
    request.onsuccess = () => {
        const result = request.result;
        if (result) {
            folderPath = result.folderPath;
        }
    };

    tx.oncomplete = () => resolve(folderPath);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    return promise;
}
