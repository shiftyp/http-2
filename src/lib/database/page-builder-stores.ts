/**
 * IndexedDB store definitions for Visual Page Builder
 */

export interface PageBuilderStoreConfig {
  name: string;
  keyPath: string;
  autoIncrement?: boolean;
  indexes?: Array<{
    name: string;
    keyPath: string | string[];
    unique?: boolean;
  }>;
}

export const PAGE_BUILDER_STORES: PageBuilderStoreConfig[] = [
  {
    name: 'sites',
    keyPath: 'id',
    indexes: [
      { name: 'by_callsign', keyPath: 'callsign' },
      { name: 'by_updated', keyPath: 'updatedAt' }
    ]
  },
  {
    name: 'pages',
    keyPath: 'id',
    indexes: [
      { name: 'by_site', keyPath: 'siteId' },
      { name: 'by_slug', keyPath: 'slug' },
      { name: 'by_updated', keyPath: 'updatedAt' }
    ]
  },
  {
    name: 'pageComponents',
    keyPath: 'id',
    indexes: [
      { name: 'by_page', keyPath: 'pageId' },
      { name: 'by_type', keyPath: 'type' },
      { name: 'by_position', keyPath: ['gridArea.row', 'gridArea.col'] }
    ]
  },
  {
    name: 'pageTemplates',
    keyPath: 'id',
    indexes: [
      { name: 'by_category', keyPath: 'category' },
      { name: 'by_author', keyPath: 'author' },
      { name: 'by_public', keyPath: 'isPublic' },
      { name: 'by_usage', keyPath: 'usageCount' }
    ]
  },
  {
    name: 'actionBindings',
    keyPath: 'id',
    indexes: [
      { name: 'by_page', keyPath: 'pageId' },
      { name: 'by_component', keyPath: 'componentId' },
      { name: 'by_event', keyPath: 'event' }
    ]
  },
  {
    name: 'serverFunctions',
    keyPath: 'id',
    indexes: [
      { name: 'by_category', keyPath: 'category' },
      { name: 'by_endpoint', keyPath: 'endpoint' }
    ]
  },
  {
    name: 'editHistory',
    keyPath: 'id',
    indexes: [
      { name: 'by_page', keyPath: 'pageId' },
      { name: 'by_session', keyPath: 'sessionId' },
      { name: 'by_timestamp', keyPath: 'timestamp' }
    ]
  }
];

/**
 * Database version for page builder
 * Increment when schema changes
 */
export const PAGE_BUILDER_DB_VERSION = 1;

/**
 * Database name for page builder
 */
export const PAGE_BUILDER_DB_NAME = 'http-radio-page-builder';

/**
 * Initialize page builder stores in existing database
 */
export function initPageBuilderStores(db: IDBDatabase): void {
  PAGE_BUILDER_STORES.forEach(store => {
    if (!db.objectStoreNames.contains(store.name)) {
      const objectStore = db.createObjectStore(store.name, {
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement
      });

      store.indexes?.forEach(index => {
        objectStore.createIndex(index.name, index.keyPath, {
          unique: index.unique
        });
      });
    }
  });
}

/**
 * Migration function for existing databases
 */
export function migratePageBuilderDatabase(
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number
): void {
  if (oldVersion < 1) {
    // Initial setup
    initPageBuilderStores(db);
  }

  // Future migrations go here
  // if (oldVersion < 2) { ... }
}