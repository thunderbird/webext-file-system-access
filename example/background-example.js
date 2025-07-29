// ID of the proxy add-on
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

fsa({command: "getVersion"});
let singleFile = await fsa({command: "readFilePicker"});
let multipleFiles = await fsa({command: "readFilesPicker"});
let folder = await fsa({command: "readFolderPicker"});

const file = new File(['1234567890'], 'text.txt', { type: 'plain/text' });
let savedFile = await fsa({command: "saveFilePicker", file});

//let reReadFile = await fsa({command: "readFile", folderId: singleFile.folderId, name: singleFile.file.name})