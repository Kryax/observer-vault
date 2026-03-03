/**
 * Federation module -- JSON Feed publishing and subscription for OCP vaults.
 */

export type {
  JSONFeed,
  JSONFeedItem,
  FederationSubscription,
  FederationConfig,
} from './types';

export { generateFeed } from './publisher';

export {
  loadFederationConfig,
  saveFederationConfig,
  addSubscription,
  getSubscription,
} from './config';

export {
  fetchFeed,
  importRecords,
  tagProvenance,
  discountTrust,
  revalidateForeignTrust,
} from './subscriber';

export type {
  SubscribeResult,
  ImportedRecord,
} from './subscriber';
