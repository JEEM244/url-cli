const SENSITIVE_PATTERNS = [
  /\b(porn|porno|xxx|hentai|nsfw)\b/i,
  /adult[-_/ ]?content/i,
  /explicit[-_/ ]?content/i
];

const $ = (id) => document.getElementById(id);
let selectedBackup = null;
let selectedBackupSnapshot = null;

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
  const candidate = (tab.title || "") + " " + getTabUrl(tab);
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(candidate));
}

function setStatus(message) {
  $("status").textContent = message;
}

function updatePrivateHint(summary, includePrivate) {
  $("private-hint").textContent = formatPrivateDiagnostic(summary, includePrivate);
}

async function getSnapshot(includePrivate) {
  const [queriedTabs, windows] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getAll({ populate: true })
  ]);

  // Cross-check both supported APIs and merge by tab ID. This also gives us
  // a diagnostic when Edge exposes different results in InPrivate mode.
  const tabsById = new Map();
  for (const tab of queriedTabs) {
    if (Number.isInteger(tab.id)) tabsById.set(tab.id, tab);
  }

  let tabsFromWindows = 0;
  for (const win of windows) {
    for (const tab of win.tabs || []) {
      if (!Number.isInteger(tab.id)) continue;
      tabsFromWindows++;
      if (!tabsById.has(tab.id)) tabsById.set(tab.id, tab);
    }
  }

  const tabs = [...tabsById.values()];

  let groups = [];
  if (chrome.tabGroups?.query) {
    try {
      groups = await chrome.tabGroups.query({});
    } catch (error) {
      console.warn("TabVault could not read tab group metadata:", error);
    }
  }

  let privateAccessAllowed = false;
  try {
    privateAccessAllowed = await chrome.extension.isAllowedIncognitoAccess();
  } catch {
    privateAccessAllowed = false;
  }

  let filtered = 0;
  let privateTabsDetected = 0;
  let privateTabsAvailable = 0;
  let privateTabsIncluded = 0;
  let privateTabsNoUrl = 0;
  let privateTabsUnsupportedUrl = 0;
  let privateTabsFiltered = 0;
  const records = [];

  const groupMap = new Map(groups.map((group) => [group.id, {
    id: group.id,
    title: group.title || "",
    color: group.color
  }]));

  for (const tab of tabs) {
    if (tab.incognito) {
      privateTabsDetected++;
      if (!privateAccessAllowed) continue;
    }

    const url = getTabUrl(tab);
    if (!url) {
      if (tab.incognito) privateTabsNoUrl++;
      continue;
    }

    if (!isSafeUrl(url)) {
      if (tab.incognito) privateTabsUnsupportedUrl++;
      continue;
    }

    if (tab.incognito) {
      privateTabsAvailable++;
      if (!includePrivate) continue;
    }

    if (isFiltered({ ...tab, url })) {
      filtered++;
      if (tab.incognito) privateTabsFiltered++;
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
    records.map((tab) => tab.groupId).filter((id) => Number.isInteger(id) && id >= 0)
  );

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
      privateTabsDetected,
      privateTabsAvailable,
      privateTabsIncluded,
      privateTabsNoUrl,
      privateTabsUnsupportedUrl,
      privateTabsFiltered,
      privateTabsFromQuery: queriedTabs.filter((tab) => tab.incognito).length,
      privateTabsFromWindows: windows.flatMap((win) => win.tabs || []).filter((tab) => tab.incognito).length
    },
    tabs: records
  };
}

function formatPrivateDiagnostic(summary, includePrivate) {
  if (!summary.privateAccessAllowed) {
    return "Edge no ha autorizado el acceso InPrivate. Activa «Permitir en InPrivate» en los detalles de TabVault.";
  }

  const parts = [
    summary.privateTabsDetected + " detectadas",
    summary.privateTabsIncluded + " incluidas"
  ];
  if (summary.privateTabsNoUrl) parts.push(summary.privateTabsNoUrl + " sin URL disponible");
  if (summary.privateTabsUnsupportedUrl) parts.push(summary.privateTabsUnsupportedUrl + " con dirección no compatible");
  if (summary.privateTabsFiltered) parts.push(summary.privateTabsFiltered + " excluidas por el filtro");
  parts.push("consulta tabs: " + summary.privateTabsFromQuery);
  parts.push("ventanas: " + summary.privateTabsFromWindows);

  if (!includePrivate) {
    return parts.join(" · ") + ". Marca la casilla para incluirlas.";
  }

  if (summary.privateTabsFromQuery !== summary.privateTabsFromWindows) {
    return parts.join(" · ") + ". Se combinaron ambas consultas para recuperar el máximo disponible.";
  }

  return parts.join(" · ") + ".";
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

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadJson(data) {
  downloadBlob(
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8",
    "tabvault_" + timestampForFilename() + ".json"
  );
}

async function createBoardHtml(snapshot) {
  const sourceTabs = Array.isArray(snapshot.tabs) ? snapshot.tabs : [];
  const tabs = sourceTabs
    .filter((tab) => tab && isSafeUrl(tab.url) && !isFiltered(tab))
    .map((tab) => {
      const parsedUrl = new URL(tab.url);
      const groupId = Number.isInteger(tab.groupId) && tab.groupId >= 0 ? tab.groupId : -1;
      const windowId = Number.isInteger(tab.windowId) ? tab.windowId : 0;
      const group = tab.group && typeof tab.group === "object" ? tab.group : null;

      return {
        title: String(tab.title || parsedUrl.hostname),
        url: tab.url,
        domain: parsedUrl.hostname,
        groupKey: groupId >= 0 ? "w" + windowId + "-g" + groupId : "w" + windowId + "-none",
        groupTitle: group && group.title ? String(group.title) : (groupId >= 0 ? "Grupo " + groupId : "Sin grupo"),
        groupColor: group && typeof group.color === "string" ? group.color : "grey",
        index: Number.isInteger(tab.index) ? tab.index : 0,
        pinned: Boolean(tab.pinned),
        active: Boolean(tab.active),
        incognito: Boolean(tab.incognito)
      };
    })
    .sort((a, b) => a.index - b.index);

  const boardData = {
    generatedAt: new Date().toISOString(),
    tabs,
    hasPrivateTabs: tabs.some((tab) => tab.incognito)
  };

  const safeJson = JSON.stringify(boardData)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  const response = await fetch(chrome.runtime.getURL("board-template.html"));
  if (!response.ok) throw new Error("No se pudo cargar la plantilla de la cartelera.");
  const template = await response.text();
  if (!template.includes("__BOARD_DATA__")) throw new Error("La plantilla de cartelera está incompleta.");
  return template.replace("__BOARD_DATA__", safeJson);
}

async function downloadBoard(snapshot) {
  const html = await createBoardHtml(snapshot);
  downloadBlob(
    html,
    "text/html;charset=utf-8",
    "tabvault_cartelera_" + timestampForFilename() + ".html"
  );
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
    setStatus("Respaldo JSON creado");
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

$("create-board").addEventListener("click", async () => {
  const button = $("create-board");
  button.disabled = true;
  setStatus("Creando cartelera…");
  try {
    const snapshot = await getSnapshot($("include-private").checked);
    await downloadBoard(snapshot);
    setStatus("Cartelera creada");
  } catch (error) {
    setStatus("Error");
    console.error("TabVault board generation failed:", error);
  } finally {
    button.disabled = false;
  }
});

$("backup-file").addEventListener("change", async (event) => {
  selectedBackup = null;
  selectedBackupSnapshot = null;
  $("restore").disabled = true;
  $("create-from-backup").disabled = true;
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.application !== "TabVault" || !Array.isArray(parsed.tabs)) {
      throw new Error("Formato de respaldo no reconocido.");
    }
    const safeTabs = parsed.tabs.filter((tab) => tab && isSafeUrl(tab.url) && !isFiltered(tab));
    selectedBackup = safeTabs;
    selectedBackupSnapshot = { ...parsed, tabs: safeTabs };
    $("restore-preview").textContent = safeTabs.length + " pestañas válidas listas para restaurar o convertir en cartelera.";
    $("restore").disabled = safeTabs.length === 0;
    $("create-from-backup").disabled = safeTabs.length === 0;
  } catch (error) {
    $("restore-preview").textContent = "No se pudo leer el respaldo. Comprueba que sea un JSON de TabVault.";
  }
});

$("create-from-backup").addEventListener("click", async () => {
  if (!selectedBackupSnapshot || !selectedBackupSnapshot.tabs.length) return;
  const button = $("create-from-backup");
  button.disabled = true;
  setStatus("Convirtiendo JSON…");
  try {
    await downloadBoard(selectedBackupSnapshot);
    setStatus("Cartelera creada desde JSON");
  } catch (error) {
    setStatus("Error");
    console.error("TabVault backup board generation failed:", error);
  } finally {
    button.disabled = false;
  }
});

$("restore").addEventListener("click", async () => {
  if (!selectedBackup?.length) return;
  const confirmed = confirm("¿Abrir " + selectedBackup.length + " pestañas del respaldo?");
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
    setStatus(restored + " abiertas");
    $("restore-preview").textContent = "Se abrieron " + restored + " pestañas.";
  } catch (error) {
    setStatus("Restauración parcial");
    $("restore-preview").textContent = "Se abrieron " + restored + " pestañas antes del error.";
    console.error("TabVault restore failed:", error);
  } finally {
    button.disabled = false;
  }
});

refreshSummary();
