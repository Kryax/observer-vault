"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ObserverGovernancePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/schema.ts
var SCHEMA = {
  meta_version: 1,
  required: ["meta_version", "kind", "status", "authority", "domain", "source"],
  enums: {
    kind: [
      "brainstorm",
      "ideas_packet",
      "session",
      "architecture",
      "decision",
      "plan",
      "build_log",
      "receipt",
      "policy",
      "philosophy",
      "theory",
      "exit_artifact",
      "handoff",
      "retrospective",
      "pre_mortem",
      "summary",
      "priming"
    ],
    status: [
      "inbox",
      "draft",
      "review",
      "canonical",
      "archived",
      "superseded"
    ],
    authority: [
      "none",
      "low",
      "medium",
      "high",
      "foundational"
    ],
    domain: [
      "consciousness",
      "governance",
      "council",
      "vault",
      "infrastructure",
      "oil",
      "search",
      "coordination",
      "philosophy",
      "gaming",
      "personal",
      "geopolitics",
      "memory"
    ],
    source: [
      "adam_decision",
      "claude_conversation",
      "gpt_build",
      "atlas_write",
      "vault_synthesis",
      "external_research",
      "mobile_capture"
    ],
    confidence: [
      "speculative",
      "provisional",
      "tested",
      "proven",
      "foundational"
    ],
    mode: [
      "explore",
      "design",
      "build",
      "review",
      "decide",
      "reflect"
    ],
    promoted_by: [
      "adam",
      "atlas"
    ]
  },
  domain_max: 3,
  transitions: {
    inbox: ["draft"],
    draft: ["review"],
    review: ["canonical"],
    canonical: ["archived", "superseded"],
    archived: [],
    superseded: []
  },
  human_gated: [
    "review\u2192canonical",
    "canonical\u2192archived",
    "canonical\u2192superseded"
  ],
  /** PRD 3.4: Authority minimum per status */
  authority_floor: {
    inbox: "none",
    draft: "low",
    review: "medium",
    canonical: "high",
    archived: null,
    // unchanged
    superseded: null
    // unchanged
  },
  /** Optional fields that are known but not required */
  optional_fields: [
    "confidence",
    "mode",
    "phase",
    "motifs",
    "refs",
    "created",
    "modified",
    "promoted_from",
    "promoted_date",
    "promoted_by",
    "cssclasses"
  ]
};

// src/validator.ts
var KNOWN_FIELDS = /* @__PURE__ */ new Set([
  ...SCHEMA.required,
  ...SCHEMA.optional_fields
]);
var ENUM_FIELDS = new Set(
  Object.keys(SCHEMA.enums)
);
function checkEnumValue(field, value, allowed) {
  if (typeof value === "string" && allowed.includes(value)) {
    return null;
  }
  return {
    field,
    message: `Invalid value for '${field}'. Expected one of: ${allowed.join(", ")}`,
    expected: allowed.join(", "),
    actual: value
  };
}
function checkEnumArray(field, value, allowed, max) {
  const issues = [];
  if (!Array.isArray(value)) {
    issues.push({
      field,
      message: `'${field}' must be an array`,
      expected: "array",
      actual: typeof value
    });
    return issues;
  }
  if (value.length > max) {
    issues.push({
      field,
      message: `'${field}' has ${value.length} entries but maximum is ${max}`,
      expected: `<= ${max} entries`,
      actual: value.length
    });
  }
  for (const item of value) {
    if (typeof item !== "string" || !allowed.includes(item)) {
      issues.push({
        field,
        message: `Invalid value '${String(item)}' in '${field}'. Expected one of: ${allowed.join(", ")}`,
        expected: allowed.join(", "),
        actual: item
      });
    }
  }
  return issues;
}
function validateFrontmatter(frontmatter) {
  const errors = [];
  const warnings = [];
  for (const field of SCHEMA.required) {
    if (!(field in frontmatter) || frontmatter[field] === void 0 || frontmatter[field] === null) {
      errors.push({
        field,
        message: `Missing required field '${field}'`
      });
    }
  }
  if ("meta_version" in frontmatter && frontmatter.meta_version != null) {
    const mv = frontmatter.meta_version;
    if (typeof mv !== "number" || Number.isNaN(mv)) {
      errors.push({
        field: "meta_version",
        message: `'meta_version' must be numeric`,
        expected: "number",
        actual: mv
      });
    }
  }
  for (const field of Object.keys(SCHEMA.enums)) {
    if (!(field in frontmatter) || frontmatter[field] == null) {
      continue;
    }
    const value = frontmatter[field];
    const allowed = SCHEMA.enums[field];
    if (field === "domain") {
      const arrayIssues = checkEnumArray(field, value, allowed, SCHEMA.domain_max);
      errors.push(...arrayIssues);
    } else {
      const issue = checkEnumValue(field, value, allowed);
      if (issue) {
        errors.push(issue);
      }
    }
  }
  for (const field of Object.keys(frontmatter)) {
    if (field.startsWith("x_")) {
      continue;
    }
    if (KNOWN_FIELDS.has(field)) {
      continue;
    }
    if (ENUM_FIELDS.has(field)) {
      continue;
    }
    warnings.push({
      field,
      message: `Unknown field '${field}' is not in the schema`,
      actual: frontmatter[field]
    });
  }
  return { errors, warnings };
}

// src/cssync.ts
var STATUS_CLASS_PREFIX = "status-";
var STATUS_CLASS_PATTERN = /^status-.+$/;
function syncCssClasses(frontmatter) {
  const existing = normalizeCssclasses(frontmatter.cssclasses);
  const status = frontmatter.status;
  if (typeof status !== "string" || !SCHEMA.enums.status.includes(status)) {
    return { needsUpdate: false, cssclasses: existing };
  }
  const validStatus = status;
  const targetClass = `${STATUS_CLASS_PREFIX}${validStatus}`;
  const preserved = existing.filter(
    (cls) => !STATUS_CLASS_PATTERN.test(cls)
  );
  const corrected = [...preserved, targetClass];
  const needsUpdate = !arraysEqual(existing, corrected);
  return { needsUpdate, cssclasses: corrected };
}
function normalizeCssclasses(raw) {
  if (raw == null)
    return [];
  if (typeof raw === "string")
    return raw.trim() ? [raw.trim()] : [];
  if (Array.isArray(raw)) {
    return raw.filter((item) => typeof item === "string").map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return [];
}
function arraysEqual(a, b) {
  if (a.length !== b.length)
    return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return false;
  }
  return true;
}

// src/audit.ts
var PLUGIN_DIR = ".obsidian/plugins/observer-governance";
function getAuditPath(settings) {
  return `${PLUGIN_DIR}/${settings.auditLogPath}`;
}
async function appendAuditEntry(app, entry, path = `${PLUGIN_DIR}/audit.jsonl`) {
  const record = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    ...entry
  };
  const line = JSON.stringify(record) + "\n";
  const exists = await app.vault.adapter.exists(path);
  if (!exists) {
    await app.vault.adapter.write(path, line);
  } else {
    await app.vault.adapter.append(path, line);
  }
}

// src/promoter.ts
var import_obsidian = require("obsidian");
var AUTHORITY_ORDER = SCHEMA.enums.authority;
function authorityRank(a) {
  return AUTHORITY_ORDER.indexOf(a);
}
function getNextStatuses(currentStatus) {
  const next = SCHEMA.transitions[currentStatus];
  return [...next];
}
function isHumanGated(from, to) {
  const key = `${from}\u2192${to}`;
  return SCHEMA.human_gated.includes(key);
}
function getAuthorityFloor(status) {
  return SCHEMA.authority_floor[status];
}
function adjustAuthority(currentAuthority, newStatus) {
  if (newStatus === "inbox")
    return "none";
  const floor = getAuthorityFloor(newStatus);
  if (floor === null)
    return currentAuthority;
  if (authorityRank(currentAuthority) < authorityRank(floor)) {
    return floor;
  }
  return currentAuthority;
}
var PromotionModal = class extends import_obsidian.Modal {
  constructor(app, documentName, fromStatus, toStatus, onConfirm) {
    super(app);
    this.rationale = "";
    this.documentName = documentName;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.onConfirm = onConfirm;
    this.requireRationale = isHumanGated(fromStatus, toStatus);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Promote Document" });
    contentEl.createEl("p", {
      text: `Document: ${this.documentName}`
    });
    contentEl.createEl("p", {
      text: `Transition: ${this.fromStatus} \u2192 ${this.toStatus}`
    });
    if (this.requireRationale) {
      contentEl.createEl("p", {
        text: "This transition is human-gated. Rationale is required.",
        cls: "mod-warning"
      });
    }
    new import_obsidian.Setting(contentEl).setName("Rationale").setDesc(
      this.requireRationale ? "Required: explain why this promotion is warranted." : "Optional: add context for the audit log."
    ).addTextArea((ta) => {
      ta.setPlaceholder("Enter rationale...");
      ta.onChange((val) => {
        this.rationale = val;
      });
      ta.inputEl.rows = 4;
      ta.inputEl.style.width = "100%";
    });
    const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
    btnRow.createEl("button", { text: "Cancel" }).addEventListener(
      "click",
      () => this.close()
    );
    const confirmBtn = btnRow.createEl("button", {
      text: "Confirm",
      cls: "mod-cta"
    });
    confirmBtn.addEventListener("click", () => {
      if (this.requireRationale && !this.rationale.trim()) {
        return;
      }
      this.onConfirm(this.rationale.trim());
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DemotionModal = class extends import_obsidian.Modal {
  constructor(app, documentName, currentStatus, onConfirm) {
    super(app);
    this.rationale = "";
    this.documentName = documentName;
    this.currentStatus = currentStatus;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Demote Document" });
    contentEl.createEl("p", {
      text: `Document: ${this.documentName}`
    });
    contentEl.createEl("p", {
      text: `Transition: ${this.currentStatus} \u2192 inbox`
    });
    contentEl.createEl("p", {
      text: "Demotion always requires rationale.",
      cls: "mod-warning"
    });
    new import_obsidian.Setting(contentEl).setName("Rationale").setDesc("Required: explain why this document is being demoted.").addTextArea((ta) => {
      ta.setPlaceholder("Enter rationale...");
      ta.onChange((val) => {
        this.rationale = val;
      });
      ta.inputEl.rows = 4;
      ta.inputEl.style.width = "100%";
    });
    const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
    btnRow.createEl("button", { text: "Cancel" }).addEventListener(
      "click",
      () => this.close()
    );
    const confirmBtn = btnRow.createEl("button", {
      text: "Confirm Demotion",
      cls: "mod-warning"
    });
    confirmBtn.addEventListener("click", () => {
      if (!this.rationale.trim()) {
        return;
      }
      this.onConfirm(this.rationale.trim());
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/manifest-gen.ts
function deriveAutoAllowed() {
  const gatedSet = new Set(SCHEMA.human_gated);
  const auto = [];
  for (const [from, targets] of Object.entries(SCHEMA.transitions)) {
    for (const to of targets) {
      const label = `${from}\u2192${to}`;
      if (!gatedSet.has(label)) {
        auto.push(label);
      }
    }
  }
  return auto;
}
function generateManifest(app, vaultPath) {
  return {
    vault_version: "1.0",
    generated_at: (/* @__PURE__ */ new Date()).toISOString(),
    vault_path: vaultPath,
    schema: {
      meta_version: SCHEMA.meta_version,
      required_fields: SCHEMA.required,
      enums: {
        kind: SCHEMA.enums.kind,
        status: SCHEMA.enums.status,
        authority: SCHEMA.enums.authority,
        source: SCHEMA.enums.source,
        confidence: SCHEMA.enums.confidence,
        mode: SCHEMA.enums.mode,
        domain: SCHEMA.enums.domain
      },
      domain_max: SCHEMA.domain_max
    },
    templates: {
      brainstorm: "00-Inbox/_templates/T_Brainstorm.md",
      ideas_packet: "00-Inbox/_templates/T_Ideas_Packet.md",
      architecture: "00-Inbox/_templates/T_Architecture.md",
      decision: "00-Inbox/_templates/T_Decision_Record.md",
      session: "00-Inbox/_templates/T_Session_Notes.md",
      build_log: "00-Inbox/_templates/T_Build_Log.md",
      receipt: "00-Inbox/_templates/T_Receipt.md",
      policy: "00-Inbox/_templates/T_Policy.md",
      philosophy: "00-Inbox/_templates/T_Philosophy.md",
      summary: "00-Inbox/_templates/T_Summary.md",
      exit_artifact: "00-Inbox/_templates/T_Exit_Artifact.md"
    },
    promotion_rules: {
      human_gated: SCHEMA.human_gated,
      auto_allowed: deriveAutoAllowed(),
      demotion: "any\u2192inbox (requires rationale)"
    },
    write_rules: {
      atlas_can_create_in: ["00-Inbox/"],
      atlas_can_update_status: ["inbox", "draft"],
      atlas_cannot_touch_status: ["canonical", "archived", "superseded"],
      atlas_default_source: "atlas_write",
      atlas_default_authority: "low"
    },
    memory: {
      priming_doc: "01-Projects/observer-council/VAULT_PRIMING.md",
      foundational_principles: "02-Knowledge/FOUNDATIONAL_PRINCIPLES.md",
      motif_registry: "02-Knowledge/patterns/MOTIF_REGISTRY.md"
    },
    folders: {
      inbox: "00-Inbox/",
      projects: "01-Projects/",
      knowledge: "02-Knowledge/",
      daily: "03-Daily/",
      archive: "04-Archive/",
      dashboards: "05-Dashboards/"
    }
  };
}
async function writeManifest(app, manifest) {
  const outputPath = ".obsidian/plugins/observer-governance/atlas-manifest.json";
  const json = JSON.stringify(manifest, null, 2);
  const adapter = app.vault.adapter;
  await adapter.write(outputPath, json);
}

// src/priming.ts
var import_obsidian2 = require("obsidian");
var OUTPUT_PATH = "01-Projects/observer-council/VAULT_PRIMING.md";
var OUTPUT_DIR = "01-Projects/observer-council";
var PROJECTS_ROOT = "01-Projects";
var FOUNDATIONAL_PRINCIPLES_PATH = "02-Knowledge/FOUNDATIONAL_PRINCIPLES.md";
var RECENT_CANONICAL_LIMIT = 10;
var HOT_MOTIF_THRESHOLD = 3;
var HOT_MOTIF_DAYS = 30;
function extractMeta(app, file) {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  return {
    file,
    title: fm?.title ?? file.basename,
    status: fm?.status,
    motifs: Array.isArray(fm?.motifs) ? fm.motifs : [],
    modified: file.stat.mtime
  };
}
function fmtDate(epoch) {
  return new Date(epoch).toISOString().slice(0, 10);
}
function nowISO() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function buildActiveProjects(docs, projectFolders) {
  const lines = ["## Active Projects", ""];
  if (projectFolders.length === 0) {
    lines.push("_No project folders found._", "");
    return lines.join("\n");
  }
  for (const folder of projectFolders.sort()) {
    const folderPrefix = `${PROJECTS_ROOT}/${folder}/`;
    const canonicalInProject = docs.filter(
      (d) => d.status === "canonical" && d.file.path.startsWith(folderPrefix)
    ).sort((a, b) => b.modified - a.modified);
    const recent = canonicalInProject[0];
    if (recent) {
      lines.push(
        `- **${folder}** -- latest canonical: "${recent.title}" (${fmtDate(recent.modified)})`
      );
    } else {
      lines.push(`- **${folder}** -- no canonical documents yet`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
function buildRecentCanonical(docs) {
  const canonical = docs.filter((d) => d.status === "canonical").sort((a, b) => b.modified - a.modified).slice(0, RECENT_CANONICAL_LIMIT);
  const lines = ["## Recent Canonical Promotions", ""];
  if (canonical.length === 0) {
    lines.push("_No canonical documents found._", "");
    return lines.join("\n");
  }
  for (const doc of canonical) {
    lines.push(`- "${doc.title}" -- ${fmtDate(doc.modified)}`);
  }
  lines.push("");
  return lines.join("\n");
}
function buildHotMotifs(docs) {
  const cutoff = Date.now() - HOT_MOTIF_DAYS * 24 * 60 * 60 * 1e3;
  const recentDocs = docs.filter((d) => d.modified >= cutoff);
  const motifDocCount = /* @__PURE__ */ new Map();
  for (const doc of recentDocs) {
    const seen = /* @__PURE__ */ new Set();
    for (const m of doc.motifs) {
      if (!seen.has(m)) {
        seen.add(m);
        motifDocCount.set(m, (motifDocCount.get(m) ?? 0) + 1);
      }
    }
  }
  const hot = [...motifDocCount.entries()].filter(([, count]) => count >= HOT_MOTIF_THRESHOLD).sort((a, b) => b[1] - a[1]);
  const lines = ["## Hot Motifs", ""];
  if (hot.length === 0) {
    lines.push(
      `_No motifs appear in ${HOT_MOTIF_THRESHOLD}+ documents from the last ${HOT_MOTIF_DAYS} days._`,
      ""
    );
    return lines.join("\n");
  }
  for (const [motif, count] of hot) {
    lines.push(`- **${motif}** -- ${count} documents`);
  }
  lines.push("");
  return lines.join("\n");
}
function buildFoundationalPrinciples() {
  const lines = [
    "## Foundational Principles",
    "",
    `See [[${FOUNDATIONAL_PRINCIPLES_PATH}]] for the full document.`,
    ""
  ];
  return lines.join("\n");
}
function buildVaultStatistics(docs) {
  const counts = {};
  for (const s of SCHEMA.enums.status) {
    counts[s] = 0;
  }
  let unknownCount = 0;
  for (const doc of docs) {
    if (doc.status && doc.status in counts) {
      counts[doc.status]++;
    } else {
      unknownCount++;
    }
  }
  const lastActivity = docs.length > 0 ? fmtDate(Math.max(...docs.map((d) => d.modified))) : "n/a";
  const lines = [
    "## Vault Statistics",
    "",
    `| Status | Count |`,
    `|--------|-------|`
  ];
  for (const s of SCHEMA.enums.status) {
    lines.push(`| ${s} | ${counts[s]} |`);
  }
  if (unknownCount > 0) {
    lines.push(`| _(no status)_ | ${unknownCount} |`);
  }
  lines.push(`| **Total** | **${docs.length}** |`);
  lines.push("");
  lines.push(`Last activity: ${lastActivity}`);
  lines.push("");
  return lines.join("\n");
}
function buildFrontmatter(existingCreated) {
  const now = nowISO();
  const created = existingCreated ?? now;
  return [
    "---",
    "meta_version: 1",
    "kind: priming",
    "status: canonical",
    "authority: high",
    "domain: [vault, governance]",
    "source: vault_synthesis",
    `created: ${created}`,
    `modified: ${now}`,
    "cssclasses: [status-canonical]",
    "---"
  ].join("\n");
}
async function refreshPriming(app) {
  const allFiles = app.vault.getMarkdownFiles();
  const docs = allFiles.map((f) => extractMeta(app, f));
  const projectsFolder = app.vault.getAbstractFileByPath(PROJECTS_ROOT);
  const projectFolders = [];
  if (projectsFolder instanceof import_obsidian2.TFolder) {
    for (const child of projectsFolder.children) {
      if (child instanceof import_obsidian2.TFolder) {
        projectFolders.push(child.name);
      }
    }
  }
  let existingCreated = null;
  const existingFile = app.vault.getAbstractFileByPath(OUTPUT_PATH);
  if (existingFile instanceof import_obsidian2.TFile) {
    const existingFm = app.metadataCache.getFileCache(existingFile)?.frontmatter;
    if (existingFm?.created) {
      existingCreated = String(existingFm.created);
    }
  }
  const sections = [
    buildFrontmatter(existingCreated),
    "",
    "# Vault Priming Document",
    "",
    "_Auto-generated by Observer Governance Plugin. Do not edit manually._",
    "",
    buildActiveProjects(docs, projectFolders),
    buildRecentCanonical(docs),
    buildHotMotifs(docs),
    buildFoundationalPrinciples(),
    buildVaultStatistics(docs)
  ];
  const content = sections.join("\n");
  const dirExists = await app.vault.adapter.exists(OUTPUT_DIR);
  if (!dirExists) {
    await app.vault.createFolder(OUTPUT_DIR);
  }
  if (existingFile instanceof import_obsidian2.TFile) {
    await app.vault.modify(existingFile, content);
  } else {
    await app.vault.create(OUTPUT_PATH, content);
  }
  const canonicalCount = docs.filter((d) => d.status === "canonical").length;
  const projectCount = projectFolders.length;
  return { canonicalCount, projectCount };
}

// src/settings.ts
var import_obsidian3 = require("obsidian");
var DEFAULT_SETTINGS = {
  validateOnSave: true,
  showNoticeOnError: true,
  autoSyncCssClasses: true,
  autoRefreshPrimingOnPromotion: false,
  auditLogPath: "audit.jsonl",
  excludedFolders: ["_templates", ".obsidian"],
  rpcEndpoint: "http://127.0.0.1:9000",
  rpcToken: "",
  rpcEnabled: false
};
var ObserverGovernanceSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Observer Governance" });
    new import_obsidian3.Setting(containerEl).setName("Validate on save").setDesc("Run frontmatter validation whenever a file is saved.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.validateOnSave).onChange(async (value) => {
        this.plugin.settings.validateOnSave = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Show notice on error").setDesc(
      "Display an Obsidian notice when validation finds errors."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showNoticeOnError).onChange(async (value) => {
        this.plugin.settings.showNoticeOnError = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Auto-sync cssclasses").setDesc(
      "Automatically keep the cssclasses frontmatter field aligned with document status."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoSyncCssClasses).onChange(async (value) => {
        this.plugin.settings.autoSyncCssClasses = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Auto-refresh priming on promotion").setDesc(
      "Regenerate the priming document after a file is promoted to canonical."
    ).addToggle(
      (toggle) => toggle.setValue(
        this.plugin.settings.autoRefreshPrimingOnPromotion
      ).onChange(async (value) => {
        this.plugin.settings.autoRefreshPrimingOnPromotion = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Audit log path").setDesc(
      "Path to the JSONL audit log file, relative to the plugin data folder."
    ).addText(
      (text) => text.setPlaceholder("audit.jsonl").setValue(this.plugin.settings.auditLogPath).onChange(async (value) => {
        this.plugin.settings.auditLogPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Excluded folders").setDesc(
      "Comma-separated list of folder paths to skip during validation."
    ).addText(
      (text) => text.setPlaceholder("_templates, .obsidian").setValue(this.plugin.settings.excludedFolders.join(", ")).onChange(async (value) => {
        this.plugin.settings.excludedFolders = value.split(",").map((folder) => folder.trim()).filter((folder) => folder.length > 0);
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h2", { text: "Observer Control Plane" });
    new import_obsidian3.Setting(containerEl).setName("Enable control plane").setDesc(
      "Send governance events (promotions, demotions) to the Observer Control Plane via JSON-RPC."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.rpcEnabled).onChange(async (value) => {
        this.plugin.settings.rpcEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("RPC endpoint").setDesc(
      "URL of the Observer Control Plane JSON-RPC endpoint."
    ).addText(
      (text) => text.setPlaceholder("http://127.0.0.1:9000").setValue(this.plugin.settings.rpcEndpoint).onChange(async (value) => {
        this.plugin.settings.rpcEndpoint = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(containerEl).setName("Bearer token").setDesc(
      "Authentication token for the control plane. Leave empty if no auth is required."
    ).addText(
      (text) => text.setPlaceholder("your-secret-token").setValue(this.plugin.settings.rpcToken).onChange(async (value) => {
        this.plugin.settings.rpcToken = value.trim();
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/rpc-client.ts
var import_obsidian4 = require("obsidian");
var ObserverRpcClient = class {
  constructor(config) {
    this.nextId = 1;
    this.config = config;
  }
  /** Update configuration (e.g. after settings change). */
  updateConfig(config) {
    this.config = config;
  }
  /** Whether the client is enabled and has a configured endpoint. */
  get enabled() {
    return this.config.enabled && this.config.endpoint.length > 0;
  }
  /**
   * Send a JSON-RPC 2.0 call to the control plane.
   *
   * Returns the `result` field on success, or null on any failure.
   * Never throws -- all errors are caught and logged to console.
   */
  async call(method, params) {
    if (!this.enabled) {
      return null;
    }
    const id = this.nextId++;
    const body = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };
    const headers = {
      "Content-Type": "application/json"
    };
    if (this.config.token.length > 0) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }
    let response;
    try {
      response = await (0, import_obsidian4.requestUrl)({
        url: this.config.endpoint,
        method: "POST",
        headers,
        body: JSON.stringify(body),
        throw: false
      });
    } catch (err) {
      console.warn(
        `[OG-RPC] Connection failed for ${method}: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
    if (response.status < 200 || response.status >= 300) {
      if (response.status === 401 || response.status === 403) {
        console.warn(`[OG-RPC] Authentication failed (${response.status}) for ${method}`);
      } else {
        console.warn(`[OG-RPC] HTTP ${response.status} for ${method}`);
      }
      return null;
    }
    let rpcResponse;
    try {
      rpcResponse = response.json;
    } catch (err) {
      console.warn(`[OG-RPC] Invalid JSON response for ${method}`);
      return null;
    }
    if (rpcResponse.error) {
      console.warn(
        `[OG-RPC] RPC error for ${method}: [${rpcResponse.error.code}] ${rpcResponse.error.message}`
      );
      return null;
    }
    return rpcResponse.result ?? null;
  }
  /**
   * Convenience: notify the control plane of a governance event.
   *
   * Creates a session, logs the event, and closes the session.
   * All best-effort -- failures are logged but never thrown.
   */
  async notifyPromotion(event) {
    if (!this.enabled)
      return;
    try {
      const sessionResult = await this.call("session.create", {
        backend: "obsidian-governance",
        description: `Document promotion: ${event.file} (${event.from} -> ${event.to})`
      });
      const sessionId = sessionResult && typeof sessionResult === "object" && "id" in sessionResult ? sessionResult.id : null;
      await this.call("audit.log", {
        session_id: sessionId,
        event_type: "document.promote",
        source: "obsidian-governance",
        payload: {
          file: event.file,
          from: event.from,
          to: event.to,
          by: event.by,
          rationale: event.rationale,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      if (sessionId) {
        await this.call("session.close", {
          id: sessionId,
          status: "completed"
        });
      }
    } catch (err) {
      console.warn(
        `[OG-RPC] Failed to notify promotion: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  /**
   * Convenience: notify the control plane of a governance demotion event.
   */
  async notifyDemotion(event) {
    if (!this.enabled)
      return;
    try {
      const sessionResult = await this.call("session.create", {
        backend: "obsidian-governance",
        description: `Document demotion: ${event.file} (${event.from} -> ${event.to})`
      });
      const sessionId = sessionResult && typeof sessionResult === "object" && "id" in sessionResult ? sessionResult.id : null;
      await this.call("audit.log", {
        session_id: sessionId,
        event_type: "document.demote",
        source: "obsidian-governance",
        payload: {
          file: event.file,
          from: event.from,
          to: event.to,
          by: event.by,
          rationale: event.rationale,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      if (sessionId) {
        await this.call("session.close", {
          id: sessionId,
          status: "completed"
        });
      }
    } catch (err) {
      console.warn(
        `[OG-RPC] Failed to notify demotion: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
};

// src/main.ts
var ObserverGovernancePlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.statusBarEl = null;
    this.lastValidation = { errors: [], warnings: [] };
    this.rpcClient = null;
  }
  async onload() {
    await this.loadSettings();
    this.rpcClient = new ObserverRpcClient({
      endpoint: this.settings.rpcEndpoint,
      token: this.settings.rpcToken,
      enabled: this.settings.rpcEnabled
    });
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("og-status-bar");
    this.statusBarEl.setText("OG: \u2713");
    this.statusBarEl.addEventListener("click", () => {
      this.showValidationReport();
    });
    this.addSettingTab(new ObserverGovernanceSettingTab(this.app, this));
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian5.TFile && file.extension === "md") {
          this.onFileModify(file);
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === "md") {
          this.validateAndUpdateStatusBar(file);
        } else {
          this.updateStatusBar({ errors: [], warnings: [] });
        }
      })
    );
    this.addCommand({
      id: "promote-document",
      name: "Promote Document",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md")
          return false;
        if (checking)
          return true;
        this.promoteDocument(file);
      }
    });
    this.addCommand({
      id: "demote-document",
      name: "Demote Document",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md")
          return false;
        if (checking)
          return true;
        this.demoteDocument(file);
      }
    });
    this.addCommand({
      id: "validate-document",
      name: "Validate Document",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md")
          return false;
        if (checking)
          return true;
        this.showValidationReport(file);
      }
    });
    this.addCommand({
      id: "validate-all",
      name: "Validate All Documents",
      callback: () => this.validateAllDocuments()
    });
    this.addCommand({
      id: "refresh-priming",
      name: "Refresh Priming Document",
      callback: () => this.refreshPrimingDocument()
    });
    this.addCommand({
      id: "regenerate-manifest",
      name: "Regenerate Manifest",
      callback: () => this.regenerateManifest()
    });
    this.addCommand({
      id: "view-audit-log",
      name: "View Audit Log",
      callback: () => this.viewAuditLog()
    });
  }
  onunload() {
  }
  // -----------------------------------------------------------------------
  // Settings
  // -----------------------------------------------------------------------
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }
  async saveSettings() {
    await this.saveData(this.settings);
    if (this.rpcClient) {
      this.rpcClient.updateConfig({
        endpoint: this.settings.rpcEndpoint,
        token: this.settings.rpcToken,
        enabled: this.settings.rpcEnabled
      });
    }
  }
  // -----------------------------------------------------------------------
  // File modify handler (PRD 4.1)
  // -----------------------------------------------------------------------
  async onFileModify(file) {
    if (this.isExcluded(file.path))
      return;
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter)
      return;
    if (this.settings.validateOnSave) {
      const result = validateFrontmatter(frontmatter);
      this.updateStatusBar(result);
      this.lastValidation = result;
      if (result.errors.length > 0 && this.settings.showNoticeOnError) {
        new import_obsidian5.Notice(
          `OG: ${result.errors.length} validation error${result.errors.length > 1 ? "s" : ""} in ${file.name}`
        );
      }
      if (result.errors.length > 0) {
        const auditPath = getAuditPath(this.settings);
        await appendAuditEntry(this.app, {
          action: "validate_fail",
          file: file.path,
          errors: result.errors.map((e) => `${e.field}: ${e.message}`)
        }, auditPath);
      }
    }
    if (this.settings.autoSyncCssClasses) {
      const syncResult = syncCssClasses(frontmatter);
      if (syncResult.needsUpdate) {
        const oldClasses = JSON.stringify(frontmatter.cssclasses ?? []);
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          fm.cssclasses = syncResult.cssclasses;
        });
        const auditPath = getAuditPath(this.settings);
        await appendAuditEntry(this.app, {
          action: "frontmatter_fix",
          file: file.path,
          field: "cssclasses",
          old: oldClasses,
          new: JSON.stringify(syncResult.cssclasses)
        }, auditPath);
      }
    }
  }
  // -----------------------------------------------------------------------
  // Status bar (PRD 10.1)
  // -----------------------------------------------------------------------
  updateStatusBar(result) {
    if (!this.statusBarEl)
      return;
    if (result.errors.length > 0) {
      this.statusBarEl.setText(`OG: \u2717 ${result.errors.length}`);
      this.statusBarEl.className = "og-status-bar";
      this.statusBarEl.addClass("og-error");
    } else if (result.warnings.length > 0) {
      this.statusBarEl.setText(`OG: \u26A0 ${result.warnings.length}`);
      this.statusBarEl.className = "og-status-bar";
      this.statusBarEl.addClass("og-warning");
    } else {
      this.statusBarEl.setText("OG: \u2713");
      this.statusBarEl.className = "og-status-bar";
      this.statusBarEl.addClass("og-valid");
    }
  }
  async validateAndUpdateStatusBar(file) {
    if (this.isExcluded(file.path)) {
      this.updateStatusBar({ errors: [], warnings: [] });
      return;
    }
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) {
      this.updateStatusBar({ errors: [], warnings: [] });
      return;
    }
    const result = validateFrontmatter(frontmatter);
    this.updateStatusBar(result);
    this.lastValidation = result;
  }
  // -----------------------------------------------------------------------
  // Promote (PRD 3.2)
  // -----------------------------------------------------------------------
  async promoteDocument(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) {
      new import_obsidian5.Notice("OG: No frontmatter found in this document.");
      return;
    }
    const currentStatus = frontmatter.status;
    if (!currentStatus || !SCHEMA.enums.status.includes(currentStatus)) {
      new import_obsidian5.Notice("OG: Document has no valid status field.");
      return;
    }
    const nextStatuses = getNextStatuses(currentStatus);
    if (nextStatuses.length === 0) {
      new import_obsidian5.Notice(`OG: No valid promotion target from "${currentStatus}".`);
      return;
    }
    const validation = validateFrontmatter(frontmatter);
    if (validation.errors.length > 0) {
      new import_obsidian5.Notice(
        `OG: Cannot promote \u2014 ${validation.errors.length} validation error(s). Fix them first.`
      );
      this.showValidationReport(file);
      return;
    }
    const targetStatus = nextStatuses[0];
    const gated = isHumanGated(currentStatus, targetStatus);
    if (gated) {
      new PromotionModal(
        this.app,
        file.basename,
        currentStatus,
        targetStatus,
        async (rationale) => {
          await this.applyPromotion(file, currentStatus, targetStatus, rationale);
        }
      ).open();
    } else {
      await this.applyPromotion(file, currentStatus, targetStatus, "");
    }
  }
  async applyPromotion(file, from, to, rationale) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.status = to;
      fm.promoted_date = (/* @__PURE__ */ new Date()).toISOString();
      fm.promoted_by = "adam";
      fm.modified = (/* @__PURE__ */ new Date()).toISOString();
      const currentAuthority = fm.authority || "none";
      fm.authority = adjustAuthority(currentAuthority, to);
      const syncResult = syncCssClasses({ ...fm, status: to });
      fm.cssclasses = syncResult.cssclasses;
    });
    const auditPath = getAuditPath(this.settings);
    await appendAuditEntry(this.app, {
      action: "promote",
      file: file.path,
      from,
      to,
      by: "adam",
      rationale
    }, auditPath);
    new import_obsidian5.Notice(`OG: Promoted ${file.basename} from ${from} to ${to}`);
    if (this.rpcClient) {
      this.rpcClient.notifyPromotion({
        file: file.path,
        from,
        to,
        by: "adam",
        rationale
      }).catch(() => {
      });
    }
    if (to === "canonical" && this.settings.autoRefreshPrimingOnPromotion) {
      await this.refreshPrimingDocument();
    }
  }
  // -----------------------------------------------------------------------
  // Demote (PRD 3.3)
  // -----------------------------------------------------------------------
  async demoteDocument(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) {
      new import_obsidian5.Notice("OG: No frontmatter found in this document.");
      return;
    }
    const currentStatus = frontmatter.status;
    if (!currentStatus || currentStatus === "inbox") {
      new import_obsidian5.Notice("OG: Document is already inbox status or has no status.");
      return;
    }
    new DemotionModal(
      this.app,
      file.basename,
      currentStatus,
      async (rationale) => {
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          fm.status = "inbox";
          fm.authority = "none";
          fm.modified = (/* @__PURE__ */ new Date()).toISOString();
          const syncResult = syncCssClasses({ ...fm, status: "inbox" });
          fm.cssclasses = syncResult.cssclasses;
        });
        const auditPath = getAuditPath(this.settings);
        await appendAuditEntry(this.app, {
          action: "demote",
          file: file.path,
          from: currentStatus,
          to: "inbox",
          by: "adam",
          rationale
        }, auditPath);
        new import_obsidian5.Notice(`OG: Demoted ${file.basename} to inbox`);
        if (this.rpcClient) {
          this.rpcClient.notifyDemotion({
            file: file.path,
            from: currentStatus,
            to: "inbox",
            by: "adam",
            rationale
          }).catch(() => {
          });
        }
      }
    ).open();
  }
  // -----------------------------------------------------------------------
  // Validation report (PRD 4.2)
  // -----------------------------------------------------------------------
  showValidationReport(file) {
    const targetFile = file || this.app.workspace.getActiveFile();
    if (!targetFile) {
      new import_obsidian5.Notice("OG: No active file to validate.");
      return;
    }
    const frontmatter = this.app.metadataCache.getFileCache(targetFile)?.frontmatter;
    if (!frontmatter) {
      new import_obsidian5.Notice("OG: No frontmatter found.");
      return;
    }
    const result = validateFrontmatter(frontmatter);
    new ValidationReportModal(this.app, targetFile.basename, result).open();
  }
  // -----------------------------------------------------------------------
  // Validate all (PRD 4.1)
  // -----------------------------------------------------------------------
  async validateAllDocuments() {
    const files = this.app.vault.getMarkdownFiles();
    let totalErrors = 0;
    let totalWarnings = 0;
    let filesWithIssues = 0;
    for (const file of files) {
      if (this.isExcluded(file.path))
        continue;
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontmatter)
        continue;
      const result = validateFrontmatter(frontmatter);
      if (result.errors.length > 0 || result.warnings.length > 0) {
        filesWithIssues++;
        totalErrors += result.errors.length;
        totalWarnings += result.warnings.length;
      }
    }
    new import_obsidian5.Notice(
      `OG: Validated ${files.length} files. ${filesWithIssues} with issues (${totalErrors} errors, ${totalWarnings} warnings).`
    );
  }
  // -----------------------------------------------------------------------
  // Refresh priming (PRD 7)
  // -----------------------------------------------------------------------
  async refreshPrimingDocument() {
    try {
      const result = await refreshPriming(this.app);
      const auditPath = getAuditPath(this.settings);
      await appendAuditEntry(this.app, {
        action: "priming_refresh",
        canonical_count: result.canonicalCount,
        project_count: result.projectCount
      }, auditPath);
      new import_obsidian5.Notice(
        `OG: Priming refreshed. ${result.canonicalCount} canonical docs, ${result.projectCount} projects.`
      );
    } catch (err) {
      new import_obsidian5.Notice(`OG: Failed to refresh priming: ${String(err)}`);
    }
  }
  // -----------------------------------------------------------------------
  // Regenerate manifest (PRD 6)
  // -----------------------------------------------------------------------
  async regenerateManifest() {
    try {
      const vaultPath = this.app.vault.adapter.basePath || "";
      const manifest = generateManifest(this.app, vaultPath);
      await writeManifest(this.app, manifest);
      const docCount = this.app.vault.getMarkdownFiles().length;
      const auditPath = getAuditPath(this.settings);
      await appendAuditEntry(this.app, {
        action: "manifest_gen",
        version: SCHEMA.meta_version,
        doc_count: docCount
      }, auditPath);
      new import_obsidian5.Notice("OG: Atlas manifest regenerated.");
    } catch (err) {
      new import_obsidian5.Notice(`OG: Failed to regenerate manifest: ${String(err)}`);
    }
  }
  // -----------------------------------------------------------------------
  // View audit log (PRD 5.3)
  // -----------------------------------------------------------------------
  async viewAuditLog() {
    const auditPath = getAuditPath(this.settings);
    const exists = await this.app.vault.adapter.exists(auditPath);
    if (!exists) {
      new import_obsidian5.Notice("OG: No audit log found yet.");
      return;
    }
    const abstractFile = this.app.vault.getAbstractFileByPath(auditPath);
    if (abstractFile instanceof import_obsidian5.TFile) {
      await this.app.workspace.openLinkText(auditPath, "", false);
    } else {
      await this.app.workspace.openLinkText(auditPath, "", false);
    }
  }
  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  isExcluded(path) {
    return this.settings.excludedFolders.some(
      (folder) => path.startsWith(folder + "/") || path.startsWith(folder)
    );
  }
};
var ValidationReportModal = class extends import_obsidian5.Modal {
  constructor(app, documentName, result) {
    super(app);
    this.documentName = documentName;
    this.result = result;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("og-validation-report");
    contentEl.createEl("h2", { text: `Validation: ${this.documentName}` });
    if (this.result.errors.length === 0 && this.result.warnings.length === 0) {
      contentEl.createEl("p", { text: "All checks passed. No issues found." });
      return;
    }
    if (this.result.errors.length > 0) {
      const section = contentEl.createDiv({ cls: "og-section" });
      section.createEl("h3", {
        text: `Errors (${this.result.errors.length})`,
        cls: "og-section-title"
      });
      for (const issue of this.result.errors) {
        const row = section.createDiv({ cls: "og-issue" });
        row.createSpan({ text: issue.field, cls: "og-issue-field" });
        row.createSpan({ text: ` \u2014 ${issue.message}`, cls: "og-issue-message" });
      }
    }
    if (this.result.warnings.length > 0) {
      const section = contentEl.createDiv({ cls: "og-section" });
      section.createEl("h3", {
        text: `Warnings (${this.result.warnings.length})`,
        cls: "og-section-title"
      });
      for (const issue of this.result.warnings) {
        const row = section.createDiv({ cls: "og-issue" });
        row.createSpan({ text: issue.field, cls: "og-issue-field" });
        row.createSpan({ text: ` \u2014 ${issue.message}`, cls: "og-issue-message" });
      }
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
