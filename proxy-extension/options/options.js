// Wrappers to interact with the DB. We do not directly load indexedDB.mjs here, but instead
// send requests to the background, to have a single instance manipulating the DB.
function getAllPermissionsSorted() {
  return browser.runtime.sendMessage({ command: "getAllPermissionsSorted", parameters: [] });
}
function removePermissionsForExtension(extensionId) {
  return browser.runtime.sendMessage({ command: "removePermissionsForExtension", parameters: [extensionId] });
}
function updatePermissions(newPermissions, item) {
  return browser.runtime.sendMessage({ command: "updatePermissions", parameters: [newPermissions, item] });
}
function removePermissions(item) {
  return browser.runtime.sendMessage({ command: "removePermissions", parameters: [item] });
}


// Localize the options page.
document.querySelectorAll("[data-l10n-content]").forEach(el => {
  el.textContent = browser.i18n.getMessage(el.dataset.l10nContent);
});


// Load current permissions.
let permissionEntries = await getAllPermissionsSorted()


// The permissions array is sorted by extensionIds.
let lastExtensionId = null;
for (let { fileName, folderPath, permissions, extensionId } of permissionEntries) {
  // Add a header if we reached a new extension.
  if (lastExtensionId != extensionId) {
    lastExtensionId = extensionId;
    let name = lastExtensionId;
    try {
      name = await browser.management.get(lastExtensionId).then(a => a.name);
    } catch { }

    const header = document.createElement("header");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    // Extension name on the left
    const title = document.createElement("span");
    title.textContent = name;

    // "Revoke All" button on the right
    const revokeAllBtn = document.createElement("button");
    revokeAllBtn.textContent = "Revoke All";
    revokeAllBtn.addEventListener("click", () => removePermissionsForExtension(extensionId))

    // Assemble header
    header.append(title, revokeAllBtn);
    document.body.append(header);
  }

  // Item.
  {
    const itemContainer = document.createElement("div");
    itemContainer.style.display = "flex";
    itemContainer.style.alignItems = "center";

    // Paragraph.
    {
      const paragraph = document.createElement("p");
      paragraph.textContent = `${fileName} - ${folderPath}`;
      itemContainer.appendChild(paragraph);
    }

    // Select.
    {
      const select = document.createElement("select");

      const option2 = document.createElement("option");
      option2.value = "1";
      option2.textContent = "read";
      if (permissions == 1) { option2.selected = true }
      select.appendChild(option2);

      const option3 = document.createElement("option");
      option3.value = "3";
      option3.textContent = "read/write";
      if (permissions == 3) { option3.selected = true }
      select.appendChild(option3);
      select.addEventListener("change", (e) => updatePermissions(e.target.value, { fileName, folderPath, extensionId }))

      itemContainer.appendChild(select);
    }

    // Revoke button.
    {
      const revokeButton = document.createElement("button");
      revokeButton.textContent = "Revoke";
      revokeButton.addEventListener("click", () => removePermissions({ fileName, folderPath, extensionId }))
      itemContainer.appendChild(revokeButton);
    }
    document.body.appendChild(itemContainer);
  }
}


// Handle DB changes.
async function handleDbChanges(request) {
  console.log("onChange", request)
}
browser.runtime.onMessage.addListener(request => {
  if (request.command == "onChange") {
    return Promise.resolve().then(
      () => handleDbChanges(request)
    )
  }
  return false;
});
