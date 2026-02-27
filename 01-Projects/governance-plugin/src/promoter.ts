/**
 * Observer Governance Plugin — Promotion State Machine
 * Implements PRD Sections 3.1-3.4: transitions, gating, authority floors, and UI modals.
 */

import { App, Modal, Setting } from 'obsidian';
import { SCHEMA, Status, Authority } from './schema';

// ---------------------------------------------------------------------------
// Authority ordering (index = rank, higher index = higher authority)
// ---------------------------------------------------------------------------

const AUTHORITY_ORDER: readonly Authority[] = SCHEMA.enums.authority;

function authorityRank(a: Authority): number {
  return AUTHORITY_ORDER.indexOf(a);
}

// ---------------------------------------------------------------------------
// PRD 3.1 — Transition lookup
// ---------------------------------------------------------------------------

/** Returns the valid next statuses for a given status. */
export function getNextStatuses(currentStatus: Status): Status[] {
  const next = SCHEMA.transitions[currentStatus];
  return [...next] as Status[];
}

// ---------------------------------------------------------------------------
// PRD 3.2 — Human gating check
// ---------------------------------------------------------------------------

/** Returns true if the from→to transition requires human confirmation. */
export function isHumanGated(from: Status, to: Status): boolean {
  const key = `${from}\u2192${to}`;
  return (SCHEMA.human_gated as readonly string[]).includes(key);
}

// ---------------------------------------------------------------------------
// PRD 3.3 — Authority floor lookup
// ---------------------------------------------------------------------------

/** Returns the minimum authority required at a given status, or null if unchanged. */
export function getAuthorityFloor(status: Status): Authority | null {
  return SCHEMA.authority_floor[status] as Authority | null;
}

// ---------------------------------------------------------------------------
// PRD 3.4 — Authority adjustment
// ---------------------------------------------------------------------------

/**
 * Adjusts authority when transitioning to a new status.
 * - If newStatus is 'inbox', always reset to 'none'.
 * - If newStatus has a floor and current authority is below it, raise to floor.
 * - Otherwise, keep current authority unchanged.
 */
export function adjustAuthority(
  currentAuthority: Authority,
  newStatus: Status,
): Authority {
  // Inbox always resets
  if (newStatus === 'inbox') return 'none';

  const floor = getAuthorityFloor(newStatus);
  if (floor === null) return currentAuthority;

  // Raise to floor if current is lower
  if (authorityRank(currentAuthority) < authorityRank(floor)) {
    return floor;
  }

  return currentAuthority;
}

// ---------------------------------------------------------------------------
// Promotion Modal — confirms a status transition
// ---------------------------------------------------------------------------

export class PromotionModal extends Modal {
  private documentName: string;
  private fromStatus: Status;
  private toStatus: Status;
  private onConfirm: (rationale: string) => void;
  private rationale = '';
  private requireRationale: boolean;

  constructor(
    app: App,
    documentName: string,
    fromStatus: Status,
    toStatus: Status,
    onConfirm: (rationale: string) => void,
  ) {
    super(app);
    this.documentName = documentName;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.onConfirm = onConfirm;
    this.requireRationale = isHumanGated(fromStatus, toStatus);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Promote Document' });

    contentEl.createEl('p', {
      text: `Document: ${this.documentName}`,
    });
    contentEl.createEl('p', {
      text: `Transition: ${this.fromStatus} \u2192 ${this.toStatus}`,
    });

    if (this.requireRationale) {
      contentEl.createEl('p', {
        text: 'This transition is human-gated. Rationale is required.',
        cls: 'mod-warning',
      });
    }

    new Setting(contentEl)
      .setName('Rationale')
      .setDesc(
        this.requireRationale
          ? 'Required: explain why this promotion is warranted.'
          : 'Optional: add context for the audit log.',
      )
      .addTextArea((ta) => {
        ta.setPlaceholder('Enter rationale...');
        ta.onChange((val) => {
          this.rationale = val;
        });
        ta.inputEl.rows = 4;
        ta.inputEl.style.width = '100%';
      });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    btnRow.createEl('button', { text: 'Cancel' }).addEventListener(
      'click',
      () => this.close(),
    );

    const confirmBtn = btnRow.createEl('button', {
      text: 'Confirm',
      cls: 'mod-cta',
    });
    confirmBtn.addEventListener('click', () => {
      if (this.requireRationale && !this.rationale.trim()) {
        // Do not allow empty rationale on gated transitions
        return;
      }
      this.onConfirm(this.rationale.trim());
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ---------------------------------------------------------------------------
// Demotion Modal — confirms a demotion back to inbox
// ---------------------------------------------------------------------------

export class DemotionModal extends Modal {
  private documentName: string;
  private currentStatus: Status;
  private onConfirm: (rationale: string) => void;
  private rationale = '';

  constructor(
    app: App,
    documentName: string,
    currentStatus: Status,
    onConfirm: (rationale: string) => void,
  ) {
    super(app);
    this.documentName = documentName;
    this.currentStatus = currentStatus;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Demote Document' });

    contentEl.createEl('p', {
      text: `Document: ${this.documentName}`,
    });
    contentEl.createEl('p', {
      text: `Transition: ${this.currentStatus} \u2192 inbox`,
    });

    contentEl.createEl('p', {
      text: 'Demotion always requires rationale.',
      cls: 'mod-warning',
    });

    new Setting(contentEl)
      .setName('Rationale')
      .setDesc('Required: explain why this document is being demoted.')
      .addTextArea((ta) => {
        ta.setPlaceholder('Enter rationale...');
        ta.onChange((val) => {
          this.rationale = val;
        });
        ta.inputEl.rows = 4;
        ta.inputEl.style.width = '100%';
      });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    btnRow.createEl('button', { text: 'Cancel' }).addEventListener(
      'click',
      () => this.close(),
    );

    const confirmBtn = btnRow.createEl('button', {
      text: 'Confirm Demotion',
      cls: 'mod-warning',
    });
    confirmBtn.addEventListener('click', () => {
      if (!this.rationale.trim()) {
        // Demotion always requires rationale
        return;
      }
      this.onConfirm(this.rationale.trim());
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
