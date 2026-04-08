/**
 * DB migration — imports db.js which auto-creates tables on init.
 * Run: node src/db/migrate.js
 */
import '../db.js';
console.log('✅ SQLite database initialized at projects/baqala/baqala.db');
console.log('Tables: merchants, products, orders, messages');
