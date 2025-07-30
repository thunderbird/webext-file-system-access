# **File Access Manager for Add-ons**

This add-on acts as a **proxy** for other Thunderbird add-ons to access the user's file system. It provides the following benefits:

- **Maintenance**: Managed by the Thunderbird Team — no need for other add-ons to ship and maintain their own custom Experiments for file system access.
- **User Experience**: Add-ons using the proxy for file system access do not need to be updated for every major Thunderbird release (as long as they do not use other Experiment APIs). This improves user experience by preventing add-ons from being disabled due to missing updates.
- **Transparency**: Users can clearly see which add-ons are accessing which files, and can update or revoke access at any time.
- **Privacy**: The proxy add-on never exposes the full folder structure; instead, it returns opaque `folderId` values that can be used for later access.

## **Usage**

Add-on developers can include the [`fsa.mjs`](https://github.com/thunderbird/webext-file-system-access/blob/main/example-client-extension/modules/fsa.mjs) module, as shown in [`background.js`](https://github.com/thunderbird/webext-file-system-access/blob/main/example-client-extension/background-example.js) script of the included example client. This module provides the following core functions:

### **Proxy API**

- `getVersion()`  
  Returns the version number of the file-system-access proxy add-on. Fails if the add-on is not installed.  
  _Use this to check whether the proxy is available and notify the user that it is needed for a specific functionality._

- `readFileWithPicker(FsaPermissions, FsaPickerOptions)`  
  Opens a file picker dialog and returns an `FsaFile` object for the selected file. If the permissions specified in the `FsaPermissions` object have not yet been granted, the user is prompted for the permissions after the file picker has closed.

- `writeFileWithPicker(Blob, FsaPermissions, FsaPickerOptions)`  
  Opens a file picker dialog, saves the provided `Blob` to the selected location, and returns an `FsaFile` object. If the permissions specified in the `FsaPermissions` object have not yet been granted, the user is prompted for the permissions after the file picker has closed.

- `getPermissions(folderId, fileName)`  
  Returns a `FsaPermissions` object with the current permissions for the specified item.

- `readFile(folderId, fileName)`  
  Attempts to read the specified file. Fails if the user has not granted `read` permission. Returns an `FsaFile` object.

- `writeFile(Blob, folderId, fileName)`  
  Attempts to write the provided data to the specified file. Fails if the user has not granted `write` permission. Returns an `FsaFile` object.

### **FsaPermissions (Object)**

Properties:

- `read`  
  A boolean value representing read access.

- `write`  
  A boolean value representing write access

### **FsaPickerOptions (Object)**

Optional properties to customize the file picker:

- `filters`  
  An array of filter entries. Each entry can be either:
  - A built-in filter string (one of `all`, `html`, `text`, `images`, `xml`, `audio`, `video`, `pdf`)
  - A custom filter object with `name` and `ext` (e.g., `{ name: "JSON", ext: "*.json" }`)
  
  If no filters are provided, the `all` filter will be used.

- `defaultFolderId`  
  A previously obtained `folderId` to suggest a default location in the picker.

- `defaultFileName`  
  A default file name to suggest in the picker dialog.

### **FsaFile (Object)**

Properties:

- `folderId`  
  The opaque ID of the folder where the file is located.
- `file`  
  A DOM `File` object representing the selected or written file.


## **Example**

This repository includes both the [`proxy add-on`](https://github.com/thunderbird/webext-file-system-access/tree/main/proxy-extension) and a fully working [`example client`](https://github.com/thunderbird/webext-file-system-access/tree/main/example-client-extension) demonstrating how to use the file system access proxy add-on.

## **Attributions**

The icons used in this repository are provided by [flaticon.com](https://www.flaticon.com/free-icons/login). The following attribution must appear on the public add-on listing (ATN):

- **URL**: https://www.flaticon.com/free-icons/login  
- **Title**: login icons  
- **Label**: Login icons created by Freepik - Flaticon
