/**
 * Federation config management.
 * Stored at {baseDir}/.ocp/federation.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import type { FederationConfig, FederationSubscription } from './types';

const DEFAULT_CONFIG: FederationConfig = {
  vault_id: '', // Generated on first init
  vault_name: 'My OCP Vault',
  publish: {
    enabled: false,
    output_path: 'feed.json',
    include_full_records: true,
  },
  subscriptions: [],
  trust: {
    default_discount: 0.5,
    allow_trust_escalation: false,
  },
};

/**
 * Load or initialize federation config.
 * Stored at {baseDir}/.ocp/federation.json
 */
export function loadFederationConfig(baseDir: string): FederationConfig {
  const configPath = join(baseDir, '.ocp', 'federation.json');

  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as FederationConfig;
  }

  // Initialize with defaults and a fresh vault_id
  const config: FederationConfig = {
    ...DEFAULT_CONFIG,
    vault_id: randomUUID(),
  };

  return config;
}

/**
 * Save federation config to disk.
 */
export function saveFederationConfig(baseDir: string, config: FederationConfig): void {
  const configPath = join(baseDir, '.ocp', 'federation.json');
  const dir = dirname(configPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Add a subscription to the config.
 * Returns a new config object (immutable).
 */
export function addSubscription(
  config: FederationConfig,
  sub: Omit<FederationSubscription, 'enabled'>,
): FederationConfig {
  return {
    ...config,
    subscriptions: [
      ...config.subscriptions,
      { ...sub, enabled: true },
    ],
  };
}

/**
 * Get a subscription by URL or name.
 */
export function getSubscription(
  config: FederationConfig,
  urlOrName: string,
): FederationSubscription | undefined {
  return config.subscriptions.find(
    (s) => s.url === urlOrName || s.name === urlOrName,
  );
}
