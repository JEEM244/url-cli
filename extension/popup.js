const SENSITIVE_PATTERNS = [
  /\b(porn|porno|xxx|hentai|nsfw)\b/i,
  /adult[-_/ ]?content/i,
  /explicit[-_/ ]?content/i
];

const $ = (id) => document.getElementById(id);
let selectedBackup = null;

function isSafeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isFiltered(tab) {
  const candidate = `${tab.title || ""} ${tab.url || ""}`;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(candidate));
}

function setStatus(message) {
  $("status").textContent = message;
}

async function getSnapshot(includePrivate) {
  const [tabs, windows, groups] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getAll({ populate: false }),
    chrome.tabGroups ? chrome.tabGroups.query({}) : Promise.resolve([])
  ]);

  const groupMap = new Map(groups.map((group) => [group.id, {
    id: group.id,
    title: group.title || "",
    color: group.color
  }]));

  let filtered = 0;
  const records = [];

  for (const tab of tabs) {
    if (tab.incognito && !includePrivate) continue;
    if (!isSafeUrl(tab.url)) continue;
    if (isFiltered(tab)) {
      filtered++;
      continue;
    }

    records.push({
      id: tab.id,
      windowId: tab.windowId,
      groupId: tab.groupId,
      group: groupMap.get(tab.groupId) || null,
      title: tab.title || tab.url,
      url: tab.url,
      active: Boolean(tab.active),
      pinned: Boolean(tab.pinned),
      incognito: Boolean(tab.incognito),
      index: tab.index
    });
  }

  return {
    application: "TabVault",
    schemaVersion: 1,
    extensionVersion: chrome.runtime.getManifest().version,
    createdAt: new Date().toISOString(),
    browser: "Microsoft Edge",
    summary: {
      windowsInspected: windows.length,
      tabsCaptured: records.length,
      groupsDetected: groups.length,
      filteredEntries: filtered
    },
    tabs: records
  };
}

async function refreshSummary() {
  try {
    const snapshot = await getSnapshot(false);
    $("tab-count").textContent = snapshot.summary.tabsCaptured;
    $("window-count").textContent = snapshot.summary.windowsInspected;
    $("group-count").textContent = snapshot.summary.groupsDetected;
  } catch {
    setStatus("Sin acceso");
  }
}

function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `tabvault_${stamp}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("capture").addEventListener("click", async () => {
  const button = $("capture");
  button.disabled = true;
  setStatus("Capturando…");
  try {
    const snapshot = await getSnapshot($("include-private").checked);
    downloadJson(snapshot);
    setStatus("Respaldo creado");
    $("tab-count").textContent = snapshot.summary.tabsCaptured;
    $("window-count").textContent = snapshot.summary.windowsInspected;
    $("group-count").textContent = snapshot.summary.groupsDetected;
  } catch (error) {
    setStatus("Error");
    console.error("TabVault capture failed:", error);
  } finally {
    button.disabled = false;
  }
});

$("backup-file").addEventListener("change", async (event) => {
  selectedBackup = null;
  $("restore").disabled = true;
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.application !== "TabVault" || !Array.isArray(parsed.tabs)) {
      throw new Error("Formato de respaldo no reconocido.");
    }
    const safeTabs = parsed.tabs.filter((tab) => isSafeUrl(tab.url) && !isFiltered(tab));
    selectedBackup = safeTabs;
    $("restore-preview").textContent = `${safeTabs.length} pestañas válidas listas para restaurar.`;
    $("restore").disabled = safeTabs.length === 0;
  } catch {
    $("restore-preview").textContent = "No se pudo leer el respaldo. Comprueba que sea un JSON de TabVault.";
  }
});

$("restore").addEventListener("click", async () => {
  if (!selectedBackup?.length) return;
  const confirmed = confirm(`¿Abrir ${selectedBackup.length} pestañas del respaldo?`);
  if (!confirmed) return;

  const button = $("restore");
  button.disabled = true;
  setStatus("Restaurando…");
  let restored = 0;

  try {
    for (const tab of selectedBackup) {
      await chrome.tabs.create({ url: tab.url, active: false });
      restored++;
    }
    setStatus(`${restored} abiertas`);
    $("restore-preview").textContent = `Se abrieron ${restored} pestañas.`;
  } catch (error) {
    setStatus("Restauración parcial");
    $("restore-preview").textContent = `Se abrieron ${restored} pestañas antes del error.`;
    console.error("TabVault restore failed:", error);
  } finally {
    button.disabled = false;
  }
});

refreshSummary();
