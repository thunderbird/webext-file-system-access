// ID of the proxy fsa add-on.
const FSA_ID = "file-system-access@addons.thunderbird.net";

async function fsa(request) {
    try {
        const rv = await browser.runtime.sendMessage(FSA_ID, request);
        console.log("Received", rv)
        return rv;
    } catch (ex) {
        console.error(`Failed to send file system access request`, ex)
    }
    return null;
}

let fsaAvailable = false;
try {
    await fsa({ command: "getVersion" });
    fsaAvailable = true;
} catch {
    // fsa not available
}

if (fsaAvailable) {
    let singleFile = await fsa({ command: "readFilePicker" });
    //let multipleFiles = await fsa({ command: "readFilesPicker", folderId: singleFile.folderId });
    //let folder = await fsa({ command: "readFolderPicker", folderId: singleFile.folderId });

    // Should open the folder used in the previous single file selection picker.
    let savedFile = await fsa({
        command: "saveFilePicker",
        file: new File(['1234567890'], 'text.txt', { type: 'plain/text' }),
        folderId: singleFile.folderId
    });
    console.log(savedFile);

    let reReadSavedFile = await fsa({
        command: "readFile",
        folderId: savedFile.folderId,
        name: savedFile.fileName
    })
    console.log(await reReadSavedFile.text());

    await fsa({
        command: "writeFile",
        folderId: savedFile.folderId,
        name: savedFile.fileName,
        file: new File(["Test 2"], "test.dat")
    })

    let reReadSavedFile2 = await fsa({
        command: "readFile",
        folderId: savedFile.folderId,
        name: savedFile.fileName
    })
    console.log(await reReadSavedFile2.text());

    // This should fail.
    await fsa({
        command: "readFile",
        folderId: singleFile.folderId,
        name: "Something else.txt"
    })
}