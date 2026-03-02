/**
 * Observer Governance Plugin — Main Entry Point
 * Wires together all modules and registers Obsidian hooks, commands, and UI.
 *
 * PRD Sections 1, 4, 9, 10, 11
 */

import { Notice, Plugin, TFile, Modal, MarkdownView } from 'obsidian';
import { SCHEMA, type Status, type Authority } from './schema';
import { validateFrontmatter, type ValidationResult } from './validator';
import { syncCssClasses } from './cssync';
import { appendAuditEntry, getAuditPath } from './audit';
import {
  getNextStatuses,
  isHumanGated,
  adjustAuthority,
  PromotionModal,
  DemotionModal,
} from './promoter';
import { generateManifest, writeManifest } from './manifest-gen';
import { refreshPriming } from './priming';
import {
  ObserverGovernanceSettingTab,
  DEFAULT_SETTINGS,
  type ObserverGovernanceSettings,
} from './settings';
import { ObserverRpcClient } from './rpc-client';

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default class ObserverGovernancePlugin extends Plugin {
  settings: ObserverGovernanceSettings = DEFAULT_SETTINGS;
  private statusBarEl: HTMLElement | null = null;
  private lastValidation: ValidationResult = { errors: [], warnings: [] };
  rpcClient: ObserverRpcClient | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Observer Control Plane RPC client (disabled by default)
    this.rpcClient = new ObserverRpcClient({
      endpoint: this.settings.rpcEndpoint,
      token: this.settings.rpcToken,
      enabled: this.settings.rpcEnabled,
    });

    // Status bar indicator (PRD 10.1)
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('og-status-bar');
    this.statusBarEl.setText('OG: \u2713');
    this.statusBarEl.addEventListener('click', () => {
      this.showValidationReport();
    });

    // Settings tab (PRD 8)
    this.addSettingTab(new ObserverGovernanceSettingTab(this.app, this));

    // File save hook: validation + cssclasses sync (PRD 4.1, 4.3)
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.onFileModify(file);
        }
      }),
    );

    // Active file change: update status bar for new file
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          this.validateAndUpdateStatusBar(file);
        } else {
          this.updateStatusBar({ errors: [], warnings: [] });
        }
      }),
    );

    // Register all 7 commands (PRD 9)
    this.addCommand({
      id: 'promote-document',
      name: 'Promote Document',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (checking) return true;
        this.promoteDocument(file);
      },
    });

    this.addCommand({
      id: 'demote-document',
      name: 'Demote Document',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (checking) return true;
        this.demoteDocument(file);
      },
    });

    this.addCommand({
      id: 'validate-document',
      name: 'Validate Document',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (checking) return true;
        this.showValidationReport(file);
      },
    });

    this.addCommand({
      id: 'validate-all',
      name: 'Validate All Documents',
      callback: () => this.validateAllDocuments(),
    });

    this.addCommand({
      id: 'refresh-priming',
      name: 'Refresh Priming Document',
      callback: () => this.refreshPrimingDocument(),
    });

    this.addCommand({
      id: 'regenerate-manifest',
      name: 'Regenerate Manifest',
      callback: () => this.regenerateManifest(),
    });

    this.addCommand({
      id: 'view-audit-log',
      name: 'View Audit Log',
      callback: () => this.viewAuditLog(),
    });
  }

  onunload(): void {
    // Obsidian handles event unregistration automatically for registerEvent calls
  }

  // -----------------------------------------------------------------------
  // Settings
  // -----------------------------------------------------------------------

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);

    // Keep the RPC client in sync with latest settings
    if (this.rpcClient) {
      this.rpcClient.updateConfig({
        endpoint: this.settings.rpcEndpoint,
        token: this.settings.rpcToken,
        enabled: this.settings.rpcEnabled,
      });
    }
  }

  // -----------------------------------------------------------------------
  // File modify handler (PRD 4.1)
  // -----------------------------------------------------------------------

  private async onFileModify(file: TFile): Promise<void> {
    if (this.isExcluded(file.path)) return;

    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) return;

    // Validation (PRD 4.1 — non-blocking, advisory only)
    if (this.settings.validateOnSave) {
      const result = validateFrontmatter(frontmatter);
      this.updateStatusBar(result);
      this.lastValidation = result;

      if (result.errors.length > 0 && this.settings.showNoticeOnError) {
        new Notice(
          `OG: ${result.errors.length} validation error${result.errors.length > 1 ? 's' : ''} in ${file.name}`,
        );
      }

      // Log validation failures to audit (PRD 5.2)
      if (result.errors.length > 0) {
        const auditPath = getAuditPath(this.settings);
        await appendAuditEntry(this.app, {
          action: 'validate_fail',
          file: file.path,
          errors: result.errors.map((e) => `${e.field}: ${e.message}`),
        }, auditPath);
      }
    }

    // cssclasses auto-sync (PRD 4.3)
    if (this.settings.autoSyncCssClasses) {
      const syncResult = syncCssClasses(frontmatter);
      if (syncResult.needsUpdate) {
        const oldClasses = JSON.stringify(frontmatter.cssclasses ?? []);
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          fm.cssclasses = syncResult.cssclasses;
        });

        // Log the fix to audit
        const auditPath = getAuditPath(this.settings);
        await appendAuditEntry(this.app, {
          action: 'frontmatter_fix',
          file: file.path,
          field: 'cssclasses',
          old: oldClasses,
          new: JSON.stringify(syncResult.cssclasses),
        }, auditPath);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Status bar (PRD 10.1)
  // -----------------------------------------------------------------------

  private updateStatusBar(result: ValidationResult): void {
    if (!this.statusBarEl) return;

    if (result.errors.length > 0) {
      this.statusBarEl.setText(`OG: \u2717 ${result.errors.length}`);
      this.statusBarEl.className = 'og-status-bar';
      this.statusBarEl.addClass('og-error');
    } else if (result.warnings.length > 0) {
      this.statusBarEl.setText(`OG: \u26A0 ${result.warnings.length}`);
      this.statusBarEl.className = 'og-status-bar';
      this.statusBarEl.addClass('og-warning');
    } else {
      this.statusBarEl.setText('OG: \u2713');
      this.statusBarEl.className = 'og-status-bar';
      this.statusBarEl.addClass('og-valid');
    }
  }

  private async validateAndUpdateStatusBar(file: TFile): Promise<void> {
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

  private async promoteDocument(file: TFile): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) {
      new Notice('OG: No frontmatter found in this document.');
      return;
    }

    const currentStatus = frontmatter.status as Status;
    if (!currentStatus || !(SCHEMA.enums.status as readonly string[]).includes(currentStatus)) {
      new Notice('OG: Document has no valid status field.');
      return;
    }

    const nextStatuses = getNextStatuses(currentStatus);
    if (nextStatuses.length === 0) {
      new Notice(`OG: No valid promotion target from "${currentStatus}".`);
      return;
    }

    // Validate before promotion (PRD 3.2.3 — blocking for promotion)
    const validation = validateFrontmatter(frontmatter);
    if (validation.errors.length > 0) {
      new Notice(
        `OG: Cannot promote — ${validation.errors.length} validation error(s). Fix them first.`,
      );
      this.showValidationReport(file);
      return;
    }

    const targetStatus = nextStatuses[0]; // Primary promotion target
    const gated = isHumanGated(currentStatus, targetStatus);

    if (gated) {
      // Human-gated: show modal (PRD 10.3)
      new PromotionModal(
        this.app,
        file.basename,
        currentStatus,
        targetStatus,
        async (rationale) => {
          await this.applyPromotion(file, currentStatus, targetStatus, rationale);
        },
      ).open();
    } else {
      // Auto-allowed: apply directly
      await this.applyPromotion(file, currentStatus, targetStatus, '');
    }
  }

  private async applyPromotion(
    file: TFile,
    from: Status,
    to: Status,
    rationale: string,
  ): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.status = to;
      fm.promoted_date = new Date().toISOString();
      fm.promoted_by = 'adam';
      fm.modified = new Date().toISOString();

      // Authority auto-adjustment (PRD 3.4)
      const currentAuthority = (fm.authority || 'none') as Authority;
      fm.authority = adjustAuthority(currentAuthority, to);

      // cssclasses sync
      const syncResult = syncCssClasses({ ...fm, status: to });
      fm.cssclasses = syncResult.cssclasses;
    });

    // Audit log
    const auditPath = getAuditPath(this.settings);
    await appendAuditEntry(this.app, {
      action: 'promote',
      file: file.path,
      from,
      to,
      by: 'adam',
      rationale,
    }, auditPath);

    new Notice(`OG: Promoted ${file.basename} from ${from} to ${to}`);

    // Notify Observer Control Plane (best-effort, non-blocking)
    if (this.rpcClient) {
      this.rpcClient.notifyPromotion({
        file: file.path,
        from,
        to,
        by: 'adam',
        rationale,
      }).catch(() => {
        // Swallowed intentionally -- ObserverRpcClient already logs warnings
      });
    }

    // Auto-refresh priming on canonical promotion (PRD 3.2.8)
    if (to === 'canonical' && this.settings.autoRefreshPrimingOnPromotion) {
      await this.refreshPrimingDocument();
    }
  }

  // -----------------------------------------------------------------------
  // Demote (PRD 3.3)
  // -----------------------------------------------------------------------

  private async demoteDocument(file: TFile): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) {
      new Notice('OG: No frontmatter found in this document.');
      return;
    }

    const currentStatus = frontmatter.status as Status;
    if (!currentStatus || currentStatus === 'inbox') {
      new Notice('OG: Document is already inbox status or has no status.');
      return;
    }

    new DemotionModal(
      this.app,
      file.basename,
      currentStatus,
      async (rationale) => {
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          fm.status = 'inbox';
          fm.authority = 'none';
          fm.modified = new Date().toISOString();

          const syncResult = syncCssClasses({ ...fm, status: 'inbox' });
          fm.cssclasses = syncResult.cssclasses;
        });

        const auditPath = getAuditPath(this.settings);
        await appendAuditEntry(this.app, {
          action: 'demote',
          file: file.path,
          from: currentStatus,
          to: 'inbox',
          by: 'adam',
          rationale,
        }, auditPath);

        new Notice(`OG: Demoted ${file.basename} to inbox`);

        // Notify Observer Control Plane (best-effort, non-blocking)
        if (this.rpcClient) {
          this.rpcClient.notifyDemotion({
            file: file.path,
            from: currentStatus,
            to: 'inbox',
            by: 'adam',
            rationale,
          }).catch(() => {
            // Swallowed intentionally -- ObserverRpcClient already logs warnings
          });
        }
      },
    ).open();
  }

  // -----------------------------------------------------------------------
  // Validation report (PRD 4.2)
  // -----------------------------------------------------------------------

  private showValidationReport(file?: TFile): void {
    const targetFile = file || this.app.workspace.getActiveFile();
    if (!targetFile) {
      new Notice('OG: No active file to validate.');
      return;
    }

    const frontmatter = this.app.metadataCache.getFileCache(targetFile)?.frontmatter;
    if (!frontmatter) {
      new Notice('OG: No frontmatter found.');
      return;
    }

    const result = validateFrontmatter(frontmatter);
    new ValidationReportModal(this.app, targetFile.basename, result).open();
  }

  // -----------------------------------------------------------------------
  // Validate all (PRD 4.1)
  // -----------------------------------------------------------------------

  private async validateAllDocuments(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    let totalErrors = 0;
    let totalWarnings = 0;
    let filesWithIssues = 0;

    for (const file of files) {
      if (this.isExcluded(file.path)) continue;

      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!frontmatter) continue;

      const result = validateFrontmatter(frontmatter);
      if (result.errors.length > 0 || result.warnings.length > 0) {
        filesWithIssues++;
        totalErrors += result.errors.length;
        totalWarnings += result.warnings.length;
      }
    }

    new Notice(
      `OG: Validated ${files.length} files. ${filesWithIssues} with issues (${totalErrors} errors, ${totalWarnings} warnings).`,
    );
  }

  // -----------------------------------------------------------------------
  // Refresh priming (PRD 7)
  // -----------------------------------------------------------------------

  private async refreshPrimingDocument(): Promise<void> {
    try {
      const result = await refreshPriming(this.app);
      const auditPath = getAuditPath(this.settings);
      await appendAuditEntry(this.app, {
        action: 'priming_refresh',
        canonical_count: result.canonicalCount,
        project_count: result.projectCount,
      }, auditPath);
      new Notice(
        `OG: Priming refreshed. ${result.canonicalCount} canonical docs, ${result.projectCount} projects.`,
      );
    } catch (err) {
      new Notice(`OG: Failed to refresh priming: ${String(err)}`);
    }
  }

  // -----------------------------------------------------------------------
  // Regenerate manifest (PRD 6)
  // -----------------------------------------------------------------------

  private async regenerateManifest(): Promise<void> {
    try {
      const vaultPath = (this.app.vault.adapter as any).basePath || '';
      const manifest = generateManifest(this.app, vaultPath);
      await writeManifest(this.app, manifest);

      const docCount = this.app.vault.getMarkdownFiles().length;
      const auditPath = getAuditPath(this.settings);
      await appendAuditEntry(this.app, {
        action: 'manifest_gen',
        version: SCHEMA.meta_version,
        doc_count: docCount,
      }, auditPath);

      new Notice('OG: Atlas manifest regenerated.');
    } catch (err) {
      new Notice(`OG: Failed to regenerate manifest: ${String(err)}`);
    }
  }

  // -----------------------------------------------------------------------
  // View audit log (PRD 5.3)
  // -----------------------------------------------------------------------

  private async viewAuditLog(): Promise<void> {
    const auditPath = getAuditPath(this.settings);
    const exists = await this.app.vault.adapter.exists(auditPath);

    if (!exists) {
      new Notice('OG: No audit log found yet.');
      return;
    }

    // Open the audit log file in Obsidian
    const abstractFile = this.app.vault.getAbstractFileByPath(auditPath);
    if (abstractFile instanceof TFile) {
      await this.app.workspace.openLinkText(auditPath, '', false);
    } else {
      // Fallback: try opening by path directly
      await this.app.workspace.openLinkText(auditPath, '', false);
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private isExcluded(path: string): boolean {
    return this.settings.excludedFolders.some(
      (folder) => path.startsWith(folder + '/') || path.startsWith(folder),
    );
  }
}

// ---------------------------------------------------------------------------
// Validation Report Modal (PRD 4.2)
// ---------------------------------------------------------------------------

class ValidationReportModal extends Modal {
  private documentName: string;
  private result: ValidationResult;

  constructor(app: any, documentName: string, result: ValidationResult) {
    super(app);
    this.documentName = documentName;
    this.result = result;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('og-validation-report');

    contentEl.createEl('h2', { text: `Validation: ${this.documentName}` });

    if (this.result.errors.length === 0 && this.result.warnings.length === 0) {
      contentEl.createEl('p', { text: 'All checks passed. No issues found.' });
      return;
    }

    if (this.result.errors.length > 0) {
      const section = contentEl.createDiv({ cls: 'og-section' });
      section.createEl('h3', {
        text: `Errors (${this.result.errors.length})`,
        cls: 'og-section-title',
      });
      for (const issue of this.result.errors) {
        const row = section.createDiv({ cls: 'og-issue' });
        row.createSpan({ text: issue.field, cls: 'og-issue-field' });
        row.createSpan({ text: ` — ${issue.message}`, cls: 'og-issue-message' });
      }
    }

    if (this.result.warnings.length > 0) {
      const section = contentEl.createDiv({ cls: 'og-section' });
      section.createEl('h3', {
        text: `Warnings (${this.result.warnings.length})`,
        cls: 'og-section-title',
      });
      for (const issue of this.result.warnings) {
        const row = section.createDiv({ cls: 'og-issue' });
        row.createSpan({ text: issue.field, cls: 'og-issue-field' });
        row.createSpan({ text: ` — ${issue.message}`, cls: 'og-issue-message' });
      }
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
