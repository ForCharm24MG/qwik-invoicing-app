import Database from 'better-sqlite3';

const db = new Database('invoicing.db');

const initDb = () => {
  // Use PRAGMA for foreign key support in SQLite
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      tax REAL NOT NULL
    );

    -- NEW: Table to store the main invoice record
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers (id)
    );

    -- NEW: Table to store the individual items of each invoice
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      priceAtSale REAL NOT NULL, -- Store price at time of sale
      taxAtSale REAL NOT NULL,   -- Store tax at time of sale
      FOREIGN KEY (invoiceId) REFERENCES invoices (id),
      FOREIGN KEY (productId) REFERENCES products (id)
    );
  `);
  console.log('Database with Invoices support initialized successfully.');
};

initDb();

export default db;