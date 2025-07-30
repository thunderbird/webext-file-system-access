// ID of the proxy fsa add-on.
const FSA_ID = "file-system-access@addons.thunderbird.net";

async function fsa(request) {
    let error = null
    try {
        let rv = await browser.runtime.sendMessage(FSA_ID, request);
        if (rv.error) {
            error = rv.error
        } else {
            return rv;
        }
    } catch {
        error = "Failed to send request."
    }
    throw new Error(`fsa.${request.command}(): ${error}`);
}

export function getVersion() {
    return fsa({ command: "getVersion" });
}

export function readFileWithPicker(
    { requestRead, requestWrite },
    { filters, defaultName, defaultFolderId }
) {
    return fsa({
        command: "readFileWithPicker",
        filters,
        defaultName,
        defaultFolderId,
        requestRead,
        requestWrite,
    })
};

export function writeFileWithPicker(
    file,
    { requestRead, requestWrite },
    { filters, defaultName, defaultFolderId }
) {
    return fsa({
        command: "writeFileWithPicker",
        file,
        filters,
        defaultName,
        defaultFolderId,
        requestRead,
        requestWrite,
    });
}

export function readFile(folderId, fileName) {
    if (!folderId || !fileName) {
        throw new Error(`fsa.readFile(): Missing folderId or fileName parameter`);
    }
    return fsa({
        command: "readFile",
        folderId,
        fileName,
    });
}

export function writeFile(file, folderId, fileName) {
    if (!file || !folderId || !fileName) {
        throw new Error(`fsa.writeFile(): Missing file, folderId or fileName parameter`);
    }
    return fsa({
        command: "writeFile",
        file,
        folderId,
        fileName,
    })
}