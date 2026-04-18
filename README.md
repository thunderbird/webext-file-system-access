# webext-file-system-access (Deprecated)

**This project has been deprecated and replaced by the [VFS-Toolkit](https://github.com/thunderbird/webext-support/tree/master/modules/vfs-toolkit).**

## VFS-Toolkit

The VFS-Toolkit is a WebExtension framework that provides virtual file system access through a provider-based architecture. Instead of granting extensions direct, unrestricted access to the user's filesystem, the VFS-Toolkit introduces a layer of abstraction where storage backends are implemented as separate provider add-ons.

### How it works

- **Client extensions** import the `vfs-client` module, which provides a unified API for file operations (`readFile`, `writeFile`, `list`, etc.) and a built-in file picker UI.
- **Storage providers** are independent add-ons that register themselves with the VFS-Toolkit and expose their storage backend (WebDAV servers, local folders, etc.) to any client extension.
- **OPFS (Origin Private File System)** is the built-in default storage — a sandboxed virtual filesystem provided by the browser, requiring no additional provider add-on.
- The **file picker** supports all registered providers in a single UI, letting users browse, select, and manage files across different storage backends.

### Available providers

- **[VFS-Provider: WebDAV](https://addons.thunderbird.net/en-US/thunderbird/addon/vfs-provider-webdav/)** — connects to WebDAV servers (ownCloud, Nextcloud, and other WebDAV-based cloud services).
- **[VFS-Provider: Local Home Folder Access](https://addons.thunderbird.net/en-US/thunderbird/addon/vfs-home-folder-access/)** — provides access to the user's local home folder through a native messaging helper, giving users the choice to continue working with local files while staying within the WebExtension security model.

### Integration status

WebExtensions currently need to vendor the `vfs-client` and/or `vfs-provider` modules from the [webext-support](https://github.com/thunderbird/webext-support) repository into their own extension source. Both modules are planned to be integrated into Thunderbird directly as a native VFS API (`browser.vfs.*`), which will eliminate the need for vendoring and provide a stable, versioned API surface for all extensions.

### Resources

- [VFS-Toolkit source code](https://github.com/thunderbird/webext-support/tree/master/modules/vfs-toolkit)
- [Search for VFS providers on ATN](https://addons.thunderbird.net/search/?q=VFS)
