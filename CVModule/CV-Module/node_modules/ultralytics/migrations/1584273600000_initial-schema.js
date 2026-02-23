/**
 * Initial schema migration
 * Creates the core tables for Ultralytics analytics
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create events table
  pgm.createTable('events', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: true },
    properties: { type: 'jsonb' },
    session_id: { type: 'varchar(255)' },
    user_id: { type: 'varchar(255)' },
    timestamp: { type: 'timestamp', notNull: true },
    created_at: {
      type: 'timestamp',
      default: pgm.func('CURRENT_TIMESTAMP')
    }
  });

  // Create indexes for events table
  pgm.createIndex('events', 'timestamp');
  pgm.createIndex('events', 'name');
  pgm.createIndex('events', 'session_id');
  pgm.createIndex('events', 'user_id');
  pgm.createIndex('events', ['timestamp', 'name']);

  // Create sessions table
  pgm.createTable('sessions', {
    id: { type: 'varchar(255)', primaryKey: true },
    started_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP')
    },
    last_activity_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP')
    },
    event_count: { type: 'integer', default: 0 }
  });

  // Create index for session lookups
  pgm.createIndex('sessions', 'last_activity_at');

  // Create API keys table
  pgm.createTable('api_keys', {
    id: 'id',
    key_hash: { type: 'varchar(64)', notNull: true, unique: true },
    name: { type: 'varchar(255)', notNull: true },
    created_at: {
      type: 'timestamp',
      default: pgm.func('CURRENT_TIMESTAMP')
    },
    last_used_at: { type: 'timestamp' },
    is_active: { type: 'boolean', default: true }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('api_keys');
  pgm.dropTable('sessions');
  pgm.dropTable('events');
};
