// ID of the proxy fsa add-on.
const FSA_ID = "file-system-access@addons.thunderbird.net";

async function fsa(request) {
    try {
        return await browser.runtime.sendMessage(FSA_ID, request);
    } catch (ex) {
        console.error(`Failed to send file system access request`, ex)
    }
    return null;
}

async function test() {
    let fsaAvailable = false;
    try {
        await fsa({ command: "getVersion" });
        fsaAvailable = true;
    } catch {
        // fsa not available
    }
    if (!fsaAvailable) {
        return;
    }

    let singleFile = await fsa({
        command: "readFilePicker",
        filters: [{ name: "JSON", ext: "*.json" }],

    });
    console.log({ singleFile });
    if (!singleFile) return;
    //let multipleFiles = await fsa({ command: "readFilesPicker", folderId: singleFile.folderId });
    //let folder = await fsa({ command: "readFolderPicker", folderId: singleFile.folderId });

    // Should open the folder used in the previous single file selection picker.
    let savedFile = await fsa({
        command: "saveFilePicker",
        file: new File(['1234567890'], 'text.txt', { type: 'plain/text' }),
        folderId: singleFile.folderId,
        filters: [{ type: "text" }],
        defaultName: "juhu.json"
    });
    console.log({ savedFile });
    if (!savedFile) return;

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

await test();
