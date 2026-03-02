import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

/**
 * Minimal interface for the governance plugin instance.
 * The main plugin class implements this by providing settings storage
 * and persistence.
 */
export interface GovernancePlugin extends Plugin {
	settings: ObserverGovernanceSettings;
	saveSettings(): Promise<void>;
}

/**
 * All configurable settings for the Observer Governance plugin.
 */
export interface ObserverGovernanceSettings {
	/** Run validation when a file is saved */
	validateOnSave: boolean;
	/** Display Obsidian notice for validation errors */
	showNoticeOnError: boolean;
	/** Keep cssclasses frontmatter field aligned with document status */
	autoSyncCssClasses: boolean;
	/** Regenerate priming doc after canonical promotions */
	autoRefreshPrimingOnPromotion: boolean;
	/** Path to the JSONL audit log, relative to the plugin folder */
	auditLogPath: string;
	/** Folder paths to skip during validation */
	excludedFolders: string[];
	/** Observer Control Plane JSON-RPC endpoint URL */
	rpcEndpoint: string;
	/** Bearer token for control plane authentication */
	rpcToken: string;
	/** Enable communication with the Observer Control Plane */
	rpcEnabled: boolean;
}

export const DEFAULT_SETTINGS: ObserverGovernanceSettings = {
	validateOnSave: true,
	showNoticeOnError: true,
	autoSyncCssClasses: true,
	autoRefreshPrimingOnPromotion: false,
	auditLogPath: "audit.jsonl",
	excludedFolders: ["_templates", ".obsidian"],
	rpcEndpoint: "http://127.0.0.1:9000",
	rpcToken: "",
	rpcEnabled: false,
};

export class ObserverGovernanceSettingTab extends PluginSettingTab {
	plugin: GovernancePlugin;

	constructor(app: App, plugin: GovernancePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Observer Governance" });

		// --- Validation ---

		new Setting(containerEl)
			.setName("Validate on save")
			.setDesc("Run frontmatter validation whenever a file is saved.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.validateOnSave)
					.onChange(async (value) => {
						this.plugin.settings.validateOnSave = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Show notice on error")
			.setDesc(
				"Display an Obsidian notice when validation finds errors.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showNoticeOnError)
					.onChange(async (value) => {
						this.plugin.settings.showNoticeOnError = value;
						await this.plugin.saveSettings();
					}),
			);

		// --- Automation ---

		new Setting(containerEl)
			.setName("Auto-sync cssclasses")
			.setDesc(
				"Automatically keep the cssclasses frontmatter field aligned with document status.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSyncCssClasses)
					.onChange(async (value) => {
						this.plugin.settings.autoSyncCssClasses = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-refresh priming on promotion")
			.setDesc(
				"Regenerate the priming document after a file is promoted to canonical.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.autoRefreshPrimingOnPromotion,
					)
					.onChange(async (value) => {
						this.plugin.settings.autoRefreshPrimingOnPromotion =
							value;
						await this.plugin.saveSettings();
					}),
			);

		// --- Paths ---

		new Setting(containerEl)
			.setName("Audit log path")
			.setDesc(
				"Path to the JSONL audit log file, relative to the plugin data folder.",
			)
			.addText((text) =>
				text
					.setPlaceholder("audit.jsonl")
					.setValue(this.plugin.settings.auditLogPath)
					.onChange(async (value) => {
						this.plugin.settings.auditLogPath = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc(
				"Comma-separated list of folder paths to skip during validation.",
			)
			.addText((text) =>
				text
					.setPlaceholder("_templates, .obsidian")
					.setValue(this.plugin.settings.excludedFolders.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.excludedFolders = value
							.split(",")
							.map((folder) => folder.trim())
							.filter((folder) => folder.length > 0);
						await this.plugin.saveSettings();
					}),
			);

		// --- Observer Control Plane ---

		containerEl.createEl("h2", { text: "Observer Control Plane" });

		new Setting(containerEl)
			.setName("Enable control plane")
			.setDesc(
				"Send governance events (promotions, demotions) to the Observer Control Plane via JSON-RPC.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.rpcEnabled)
					.onChange(async (value) => {
						this.plugin.settings.rpcEnabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("RPC endpoint")
			.setDesc(
				"URL of the Observer Control Plane JSON-RPC endpoint.",
			)
			.addText((text) =>
				text
					.setPlaceholder("http://127.0.0.1:9000")
					.setValue(this.plugin.settings.rpcEndpoint)
					.onChange(async (value) => {
						this.plugin.settings.rpcEndpoint = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Bearer token")
			.setDesc(
				"Authentication token for the control plane. Leave empty if no auth is required.",
			)
			.addText((text) =>
				text
					.setPlaceholder("your-secret-token")
					.setValue(this.plugin.settings.rpcToken)
					.onChange(async (value) => {
						this.plugin.settings.rpcToken = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
