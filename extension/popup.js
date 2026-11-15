const SENSITIVE_PATTERNS = [
  /\\b(porn|porno|xxx|hentai|nsfw)\\b/i,
  /adult[-_/ ]?content/i,
  /explicit[-_/ ]?content/i
];

const $ = (id) => document.getElementById(id);
let selectedBackup = null;

function getTabUrl(tab) {
  return tab.url || tab.pendingUrl || "";
}

function isSafeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isFiltered(tab) {
  const candidate = `${tab.title || ""} ${getTabUrl(tab)}`;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(candidate));
}

function setStatus(message) {
  $("status").textContent = message;
}

function updatePrivateHint(summary, includePrivate) {
  const hint = $("private-hint");

  if (!summary.privateAccessAllowed) {
    hint.textContent = "Edge todavía no permite el acceso InPrivate. Activa «Permitir en InPrivate» en los detalles de TabVault.";
    return;
  }

  if (summary.privateTabsAvailable === 0) {
    hint.textContent = "No se detectaron pestañas InPrivate accesibles en este momento.";
    return;
  }

  if (includePrivate) {
    hint.textContent = `${summary.privateTabsIncluded} pestañas InPrivate se incluirán en el respaldo. También se capturan las pestañas de grupos plegados.`;
    return;
  }

  hint.textContent = `${summary.privateTabsAvailable} pestañas InPrivate detectadas. Marca esta casilla para incluirlas; no necesitas abrirlas una por una.`;
}

async function getSnapshot(includePrivate) {
  const [tabs, windows] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getAll({ populate: false })
  ]);

  // A group metadata error must not prevent the tabs themselves from being saved.
  let groups = [];
  if (chrome.tabGroups?.query) {
    try {
      groups = await chrome.tabGroups.query({});
    } catch (error) {
      console.warn("TabVault could not read tab group metadata:", error);
    }
  }

  let filtered = 0;
  let privateTabsAvailable = 0;
  let privateTabsIncluded = 0;
  const records = [];

  const groupMap = new Map(groups.map((group) => [group.id, {
    id: group.id,
    title: group.title || "",
    color: group.color
  }]));

  for (const tab of tabs) {
    const url = getTabUrl(tab);
    if (!isSafeUrl(url)) continue;

    if (tab.incognito) {
      privateTabsAvailable++;
      if (!includePrivate) continue;
    }

    if (isFiltered({ ...tab, url })) {
      filtered++;
      continue;
    }

    if (tab.incognito) privateTabsIncluded++;

    records.push({
      id: tab.id,
      windowId: tab.windowId,
      groupId: tab.groupId,
      group: groupMap.get(tab.groupId) || null,
      title: tab.title || url,
      url,
      active: Boolean(tab.active),
      pinned: Boolean(tab.pinned),
      incognito: Boolean(tab.incognito),
      index: tab.index
    });
  }

  const detectedGroupIds = new Set(
    records
      .map((tab) => tab.groupId)
      .filter((groupId) => Number.isInteger(groupId) && groupId >= 0)
  );

  let privateAccessAllowed = false;
  try {
    privateAccessAllowed = await chrome.extension.isAllowedIncognitoAccess();
  } catch {
    privateAccessAllowed = false;
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
      groupsDetected: detectedGroupIds.size,
      filteredEntries: filtered,
      privateAccessAllowed,
      privateTabsAvailable,
      privateTabsIncluded
    },
    tabs: records
  };
}

async function refreshSummary() {
  try {
    const includePrivate = $("include-private").checked;
    const snapshot = await getSnapshot(includePrivate);
    $("tab-count").textContent = snapshot.summary.tabsCaptured;
    $("window-count").textContent = snapshot.summary.windowsInspected;
    $("group-count").textContent = snapshot.summary.groupsDetected;
    updatePrivateHint(snapshot.summary, includePrivate);
  } catch (error) {
    setStatus("Sin acceso");
    $("private-hint").textContent = "No se pudieron consultar las pestañas. Revisa los permisos de TabVault.";
    console.error("TabVault summary failed:", error);
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

$("include-private").addEventListener("change", refreshSummary);

$("capture").addEventListener("click", async () => {
  const button = $("capture");
  button.disabled = true;
  setStatus("Capturando…");
  try {
    const includePrivate = $("include-private").checked;
    const snapshot = await getSnapshot(includePrivate);
    downloadJson(snapshot);
    setStatus("Respaldo creado");
    $("tab-count").textContent = snapshot.summary.tabsCaptured;
    $("window-count").textContent = snapshot.summary.windowsInspected;
    $("group-count").textContent = snapshot.summary.groupsDetected;
    updatePrivateHint(snapshot.summary, includePrivate);
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
