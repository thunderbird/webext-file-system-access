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

    //let savedFile = await fsa({
    //    command: "saveFilePicker",
    //    file: new File(['1234567890'], 'text.txt', { type: 'plain/text' }),
    //    folderId: singleFile.folderId
    //});

    let reReadFile1 = await fsa({
        command: "readFile",
        folderId: singleFile.folderId,
        name: singleFile.file.name
    })
    console.log(await reReadFile1.text());

    await fsa({
        command: "writeFile",
        folderId: singleFile.folderId,
        name: singleFile.file.name,
        file: new File(["Test 2"], "test.dat")
    })

    let reReadFile2 = await fsa({
        command: "readFile",
        folderId: singleFile.folderId,
        name: singleFile.file.name
    })
    console.log(await reReadFile2.text());

    // This should fail.
    await fsa({
        command: "readFile",
        folderId: singleFile.folderId,
        name: "Something else.txt"
    })
}