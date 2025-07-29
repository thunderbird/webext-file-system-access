const dbName = "FSA";

export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create permissions object store and assign it to a variable
            let permissionsStore;
            if (!db.objectStoreNames.contains("permissions")) {
                permissionsStore = db.createObjectStore("permissions", { keyPath: "id", autoIncrement: true });
            } else {
                permissionsStore = event.target.transaction.objectStore("permissions");
            }
            // Create composite permission index if it doesn't exist
            if (!permissionsStore.indexNames.contains("permissionIndex")) {
                permissionsStore.createIndex("permissionIndex", ["extensionId", "folderPath", "fileName"], { unique: true });
            }

            // Create folders object store and assign it to a variable
            let foldersStore;
            if (!db.objectStoreNames.contains("folders")) {
                foldersStore = db.createObjectStore("folders", { keyPath: "folderId" });
            } else {
                foldersStore = event.target.transaction.objectStore("folders");
            }
            // Create an index to lookup paths, enforce unique paths.
            foldersStore.createIndex("pathIndex", "folderPath", { unique: true });
        };
    });
}

export async function addItem(item, storeName) {
    const { promise, resolve, reject } = Promise.withResolvers();

    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.add(item);
    tx.oncomplete = () => resolve(request.result); // resolve with the inserted item's key
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    return promise;
}

/**
 * Check if the usr has granted the requested permission for the given item.
 *
 * @param {integer} reqPermission -The permission value to check
 * @param {Object} item - An object that has extensionId, folderPath, fileName
 * @returns {Promise<Boolean>} Whether the permission was granted or not
 */
export async function hasPermissions(reqPermission, item) {
    const { promise, resolve, reject } = Promise.withResolvers();

    const db = await openDB();
    const tx = db.transaction("permissions", "readwrite");
    const store = tx.objectStore("permissions");
    const index = store.index("permissionIndex");

    const key = [item.extensionId, item.folderPath, item.fileName];
    const getReq = index.get(key);

    let granted = false;
    getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
            granted = (record.permission & reqPermission) === reqPermission;
        }
    };

    tx.oncomplete = () => resolve(granted);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    return promise;
}

/**
 * Add or update the granted permission for the given item.
 *
 * @param {integer} newPermission - The permission value you want to store
 * @param {Object} item - An object that has extensionId, folderPath, fileName
 * @returns {Promise<Object>} The record that was written to the DB
 */
export async function updatePermissions(newPermission, item) {
    const { promise, resolve, reject } = Promise.withResolvers();

    const db = await openDB();
    const tx = db.transaction("permissions", "readwrite");
    const store = tx.objectStore("permissions");
    const index = store.index("permissionIndex");

    const key = [item.extensionId, item.folderPath, item.fileName];
    const getReq = index.get(key);

    let savedRecord;

    getReq.onsuccess = () => {
        const record = getReq.result;

        if (record) {
            record.permission = newPermission;
            // same primary key (id) → update
            store.put(record);
            savedRecord = record;
        } else {
            const newRecord = {
                extensionId: item.extensionId,
                folderPath: item.folderPath,
                fileName: item.fileName,
                permission: newPermission
                // no id → autoIncrement will create one
            };
            const addReq = store.add(newRecord);
            addReq.onsuccess = () => {
                // capture generated id
                newRecord.id = addReq.result;
                savedRecord = newRecord;
            };
        }
    };

    tx.oncomplete = () => resolve(savedRecord);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    return promise;
}

/**
 *  * Lookup a folderId by its folderPath
 *
 * If the path already exists in the database, its associated folderId is returned.
 * If the path does not exist, a new UUID is generated, stored, and returned.
 *
 * @param {string} folderPath - The full path of the folder to look up or insert.
 * @returns {Promise<string>} A promise that resolves with the UUID of the folder.
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
            const addReq = store.add(item);
            addReq.onsuccess = () => {
                folderId = item.folderId;
            };
            addReq.onerror = () => reject(addReq.error);
        }
    };

    getReq.onerror = () => reject(getReq.error);

    tx.oncomplete = () => resolve(folderId);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    return promise;
}

/**
 * Lookup a folderPath by its folderId.
 *
 * @param {string} folderId - The UUID of the folder.
 * @returns {Promise<string|null>} The folder path, or null if not found.
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

    request.onerror = () => reject(request.error);

    tx.oncomplete = () => resolve(folderPath);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    return promise;
}
