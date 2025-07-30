import * as fsa from './modules/fsa.mjs'

browser.action.onClicked.addListener(async () => {
    // Check if the FSA proxy is available and bail out if not.
    let fsaAvailable = false;
    try {
        await fsa.getVersion();
        fsaAvailable = true;
    } catch {
        // fsa not available
    }
    if (!fsaAvailable) {
        return;
    }

    // Read a file using a file picker, request persistent read access.
    let singleFile = await fsa.readFileWithPicker(
        {
            requestRead: true,
            requestWrite: false
        },
        {
        }
    );
    if (!singleFile) return;
    console.log({
        singleFile,
        fileName: singleFile.file.name,
        folderId: singleFile.folderId,
        content: await singleFile.file.text()
    });

    // Check permissions.
    let permissions = await fsa.getPermissions(
        singleFile.folderId,
        singleFile.file.name
    );
    console.log("Granted Permissions are", permissions);

    // Re-read the just saved file, using the granted read permission.
    let reReadSavedFile = await fsa.readFile(
        singleFile.folderId,
        singleFile.file.name
    )
    console.log({
        reReadSavedFile,
        fileName: reReadSavedFile.file.name,
        folderId: reReadSavedFile.folderId,
        content: await reReadSavedFile.file.text()
    });
})

async function test() {
    // Check if the FSA proxy is available and bail out if not.
    let fsaAvailable = false;
    try {
        await fsa.getVersion();
        fsaAvailable = true;
    } catch {
        // fsa not available
    }
    if (!fsaAvailable) {
        return;
    }

    // Test 1: Read a file using a file picker.
    let singleFile = await fsa.readFileWithPicker(
        {
            requestRead: true,
            requestWrite: false
        },
        {
            filters: [{ name: "JSON", ext: "*.json" }],
        }
    );
    if (!singleFile) return;
    console.log({
        singleFile,
        fileName: singleFile.file.name,
        folderId: singleFile.folderId,
        content: await singleFile.file.text()
    });


    // Test 2: Write a file using a file picker. Should open the folder used in
    // the previous single file selection picker.
    let savedFile = await fsa.writeFileWithPicker(
        new Blob(['1234567890']),
        {
            requestRead: true,
            requestWrite: true,
        },
        {
            filters: [{ type: "text" }],
            defaultName: "juhu.json",
            defaultFolderId: singleFile.folderId,
        }
    );
    if (!savedFile) return;
    console.log({
        savedFile,
        fileName: savedFile.file.name,
        folderId: savedFile.folderId,
        content: await savedFile.file.text()
    });

    // Test 3: Re-read the just saved file, using the granted read permission.
    let reReadSavedFile = await fsa.readFile(
        savedFile.folderId,
        savedFile.file.name
    )
    console.log({
        reReadSavedFile,
        fileName: reReadSavedFile.file.name,
        folderId: reReadSavedFile.folderId,
        content: await reReadSavedFile.file.text()
    });

    // Test 4: Write a custom BLOB into the just saved file, using the granted
    // write permission.
    let reSavedFile = await fsa.writeFile(
        new Blob(["Test 2"]),
        savedFile.folderId,
        savedFile.file.name,
    );
    console.log({
        reSavedFile,
        fileName: reSavedFile.file.name,
        folderId: reSavedFile.folderId,
        content: await reSavedFile.file.text()
    });

    // Test 5: Re-read the just saved file with the custom BLOB content, using
    // the granted read permission.
    let reReadSavedFile2 = await fsa.readFile(
        reSavedFile.folderId,
        reSavedFile.file.name
    );
    console.log({
        reReadSavedFile2,
        fileName: reReadSavedFile2.file.name,
        folderId: reReadSavedFile2.folderId,
        content: await reReadSavedFile2.file.text()
    });


    // Test 6: Trying to read a file without permission. This should fail.
    await fsa.readFile(
        singleFile.folderId,
        "Something else.txt"
    )
}

// test()