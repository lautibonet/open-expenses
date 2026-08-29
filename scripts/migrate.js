'use strict';

/**
 * Sheet-to-Backup migration tooling.
 *
 * Converts the migrated sheet sources under `docs/original-spec/migration`
 * (`movements.csv`, `accounts.txt`, `categories.txt`) into a valid Backup JSON
 * the app can Restore-from-file, and writes it back into that folder.
 *
 * The three source files and the generated Backup are intentionally kept out of
 * git (see the ignore rules); only this script is committed.
 *
 * Run:  node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');

// ---- Config ---------------------------------------------------------------

const DEFAULT_SRC_DIR = path.join(__dirname, '..', 'docs', 'original-spec', 'migration');
const DEFAULT_OUTPUT_FILE = 'backup.json';

// The calendar year all Periods in the sheet belong to. The sheet does not carry
// a year; it covers Periods January through August and straddles a New Year
// boundary (December-dated rows belong to the January Period). See ADR 0007.
const SHEET_YEAR = 2026;

// ---- Model helpers ----------------------------------------------------------

// Month abbreviations as they appear in the sheet's Fecha column, mapped to the
// JS month numbers (1..12). As weekday abbreviations are not used to derive the
// Date (the sheet contains at least one weekday typo), only day + month matter.
const MONTH_BY_ABBR = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

// Spanish Period names as they appear in the sheet's Período column, mapped to
// the English month names the app uses for its Period vocabulary.
const EN_PERIOD_BY_ES = {
  Enero: 'January', Febrero: 'February', Marzo: 'March', Abril: 'April',
  Mayo: 'May', Junio: 'June', Julio: 'July', Agosto: 'August',
  Septiembre: 'September', Octubre: 'October', Noviembre: 'November', Diciembre: 'December',
};

// ---- Parsers ---------------------------------------------------------------

/** RFC-4180 style CSV parser (handles quoted fields containing commas). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse an amount in the sheet's localised format, e.g. `€2.544,95` or
 * `€12.062,06`. Strips currency symbols, drops the `.` thousands separators and
 * treats `,` as the decimal separator.
 */
function parseAmount(raw) {
  const digits = String(raw).replace(/[^\d.,]/g, '');
  const normalized = digits.replace(/\./g, '').replace(',', '.');
  return Number.parseFloat(normalized);
}

/** Parse a Fecha cell of the form `lun 22 dic` into a calendar ISO date. */
function parseDate(raw) {
  const match = String(raw).trim().match(/^\S+\s+(\d{1,2})\s+(\w+)/);
  if (!match) {
    throw new Error(`Cannot parse date cell "${raw}"`);
  }
  const day = Number.parseInt(match[1], 10);
  const monthAbbr = match[2].toLowerCase();
  const month = MONTH_BY_ABBR[monthAbbr];
  if (!month) {
    throw new Error(`Unknown month abbreviation "${match[2]}" in "${raw}"`);
  }

  // The sheet's Period belongs to SHEET_YEAR. December-dated rows are the
  // January Period's previous calendar year (see ADR 0007); every other month
  // falls in the same calendar year as its Period.
  const year = month === 12 ? SHEET_YEAR - 1 : SHEET_YEAR;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
}

/** Parse accounts.txt: each data line is `Name;<amount>`. */
function parseAccounts(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0];
  if (!/^Cuentas/.test(header.trim())) {
    throw new Error('accounts.txt is missing its header row');
  }

  const accounts = [];
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(';');
    if (idx === -1) {
      throw new Error(`Malformed account line: "${line}"`);
    }
    const name = line.slice(0, idx).trim();
    const initialBalance = parseAmount(line.slice(idx + 1));
    if (!name) {
      throw new Error(`Account line missing name: "${line}"`);
    }
    accounts.push({ name, initialBalance });
  }
  return accounts;
}

/** Parse categories.txt: one category name per line. */
function parseCategories(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Parse movements.csv into plain rows, skipping the header. The amount, account
 * and comment columns are kept as raw strings; type is `'Ingreso'` or `'Salida'`.
 */
function parseMovements(csvText) {
  const rows = parseCsv(csvText);
  const header = rows[0].map((h) => h.trim());
  const required = ['Fecha', 'Período', 'Entrada / Salida', 'Monto', 'Categoría', 'Cuenta'];
  for (const column of required) {
    if (!header.includes(column)) {
      throw new Error(`movements.csv is missing the "${column}" column`);
    }
  }

  const movements = [];
  for (const row of rows.slice(1)) {
    if (row.length < 6 || !row[0].trim()) {
      continue;
    }
    movements.push({
      dateCell: row[0].trim(),
      period: row[1].trim(),
      type: row[2].trim(),
      amount: parseAmount(row[3]),
      category: row[4].trim(),
      account: row[5].trim(),
      comment: (row[6] ?? '').trim(),
    });
  }
  return movements;
}

// ---- Assembly --------------------------------------------------------------

/** True when a category is one of the internal-transfer markers. */
function isTransferCategory(name) {
  return /Transferencia Interna/.test(name);
}

/** Category type derived from the source name prefix. */
function categoryType(name) {
  return /^Ingreso -/.test(name) ? 'Income' : 'Expense';
}

/**
 * Build a full Backup snapshot from parsed source content.
 *
 * @param {Array<{name:string, initialBalance:number}>} accountsSpec
 * @param {string[]} categoriesSpec All category names from categories.txt.
 * @param {Array<object>} movements Parsed movement rows.
 * @param {object} [options]
 * @return {{snapshot:object, stats:object}}
 */
function buildBackup(accountsSpec, categoriesSpec, movements, options = {}) {
  const exportedAt = options.exportedAt ?? new Date().toISOString();

  // Accounts keep the source order; the sheet is entirely in the Base Currency.
  const accounts = accountsSpec.map((a, i) => ({
    id: i + 1,
    name: a.name,
    currency: 'EUR',
    initialBalance: a.initialBalance,
    active: true,
    createdAt: exportedAt,
  }));

  // Only the Categories actually used by Transactions are emitted (the internal
  // transfer categories never back a Transaction).
  const usedCategoryNames = new Set(
    movements.filter((m) => !isTransferCategory(m.category)).map((m) => m.category),
  );
  const categoryIdByName = new Map();
  const categories = [];
  for (const name of categoriesSpec) {
    if (!usedCategoryNames.has(name)) {
      continue;
    }
    const id = categories.length + 1;
    categoryIdByName.set(name, id);
    categories.push({
      id,
      name,
      type: categoryType(name),
      active: true,
      createdAt: exportedAt,
    });
  }

  const accountIdByName = new Map(accounts.map((a) => [a.name, a.id]));

  const transactions = [];
  const transfers = [];

  // Transfer rows appear as paired Salida (source) / Ingreso (destination) rows
  // sharing an amount and Period. Reassemble each pair into a single Transfer;
  // never a Transaction.
  const transferInRows = movements
    .filter((m) => isTransferCategory(m.category) && m.type === 'Ingreso')
    .map((m) => ({ ...m, _used: false }));

  for (const m of movements) {
    if (isTransferCategory(m.category)) {
      if (m.type === 'Salida') {
        const match = transferInRows.find(
          (inRow) => !inRow._used && inRow.amount === m.amount && inRow.period === m.period,
        );
        if (!match) {
          throw new Error(`No Ingreso pair found for transfer from "${m.account}" ` +
            `${m.amount} ${m.period}`);
        }
        match._used = true;
        transfers.push({
          id: transfers.length + 1,
          sourceAccountId: accountIdByName.get(m.account),
          destinationAccountId: accountIdByName.get(match.account),
          sourceAmount: m.amount,
          destinationAmount: m.amount,
          exchangeRate: 1,
          baseCurrencyAmount: m.amount,
          date: parseDate(m.dateCell),
          period: EN_PERIOD_BY_ES[m.period] ?? m.period,
          year: SHEET_YEAR,
          note: m.comment,
          createdAt: exportedAt,
        });
      }
      continue;
    }

    const transaction = {
      id: transactions.length + 1,
      accountId: accountIdByName.get(m.account),
      categoryId: categoryIdByName.get(m.category),
      amount: m.amount,
      date: parseDate(m.dateCell),
      period: EN_PERIOD_BY_ES[m.period] ?? m.period,
      year: SHEET_YEAR,
      // Same-currency (Base EUR) transactions carry no rate or converted amount,
      // matching the app's behaviour for base-currency entries.
      exchangeRate: null,
      baseCurrencyAmount: null,
      note: m.comment,
      createdAt: exportedAt,
    };

    if (transaction.categoryId == null || transaction.accountId == null) {
      throw new Error(`Could not resolve category/account for ${m.dateCell} ${m.category}`);
    }

    transactions.push(transaction);
  }

  const strayIngreso = transferInRows.filter((inRow) => !inRow._used);
  if (strayIngreso.length > 0) {
    const s = strayIngreso[0];
    throw new Error(`Ingreso transfer row with no Salida pair: ${s.account} ${s.amount} ${s.period}`);
  }

  const snapshot = {
    accounts,
    categories,
    transactions,
    transfers,
    profile: [
      {
        id: 1,
        baseCurrency: 'EUR',
        onboardingCompleted: true,
        lastBackupAt: null,
      },
    ],
    exportedAt,
  };

  return {
    snapshot,
    stats: {
      transactions: transactions.length,
      transfers: transfers.length,
      accounts: accounts.length,
      categories: categories.length,
      movements: movements.length,
    },
  };
}

// ---- Verification ----------------------------------------------------------

/**
 * Mirrors the app's `isBackupSnapshotShape` (src/app/backup/backup-snapshot.ts)
 * so the emitted Backup is checked against the app's contract without importing
 * browser-bound code here.
 */
function isBackupShape(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    typeof value.exportedAt === 'string' &&
    Array.isArray(value.accounts) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.transactions) &&
    Array.isArray(value.transfers) &&
    Array.isArray(value.profile)
  );
}

// ---- Reconciliation --------------------------------------------------------

/** Signed contribution of a transaction to an account or category total. */
function signedAmount(t, categoryTypeById) {
  const type = categoryTypeById.get(t.categoryId);
  return type === 'Income' ? t.amount : -t.amount;
}

/**
 * Produce a reconciliation report describing row counts and per-account and
 * per-category totals derived from the assembled Transactions. `movementCount`
 * is the number of source rows the snapshot was assembled from, so the report
 * shows how many sheet rows collapsed into how many Transactions and Transfers.
 */
function reconciliation(snapshot, movementCount) {
  const categoryTypeById = new Map(snapshot.categories.map((c) => [c.id, c.type]));

  const accountTotal = new Map(snapshot.accounts.map((a) => [a.id, 0]));
  const categoryTotal = new Map(snapshot.categories.map((c) => [c.id, 0]));

  for (const t of snapshot.transactions) {
    const signed = signedAmount(t, categoryTypeById);
    accountTotal.set(t.accountId, (accountTotal.get(t.accountId) ?? 0) + signed);
    categoryTotal.set(t.categoryId, (categoryTotal.get(t.categoryId) ?? 0) + signed);
  }

  const accountReport = snapshot.accounts
    .map((a) => ({ name: a.name, initialBalance: a.initialBalance, total: accountTotal.get(a.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const categoryReport = snapshot.categories
    .map((c) => ({ name: c.name, total: categoryTotal.get(c.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    movementCount,
    transactionCount: snapshot.transactions.length,
    transferCount: snapshot.transfers.length,
    accountCount: snapshot.accounts.length,
    categoryCount: snapshot.categories.length,
    accountTotals: accountReport,
    categoryTotals: categoryReport,
  };
}

function formatMoney(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}€${Math.abs(value).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function printReport(report) {
  const transferSourceRows = report.movementCount - report.transactionCount;
  console.log('Reconciliation report');
  console.log('--------------------');
  console.log(`Sheet rows:       ${report.movementCount} (${transferSourceRows} transfer rows -> ${report.transferCount} Transfers)`);
  console.log(`Transactions:     ${report.transactionCount}`);
  console.log(`Transfers:        ${report.transferCount}`);
  console.log(`Accounts:         ${report.accountCount}`);
  console.log(`Categories:       ${report.categoryCount}`);
  console.log('');
  console.log('Per-account totals (from sheet Transactions only):');
  for (const a of report.accountTotals) {
    console.log(`  ${a.name.padEnd(20)} ${formatMoney(a.total)}`);
  }
  console.log('');
  console.log('Per-category totals:');
  for (const c of report.categoryTotals) {
    console.log(`  ${c.name.padEnd(32)} ${formatMoney(c.total)}`);
  }
  console.log('');
}

// ---- Main ------------------------------------------------------------------

function main(argv) {
  const srcDir = argv[2] ?? DEFAULT_SRC_DIR;
  const outputFile = argv[3] ?? DEFAULT_OUTPUT_FILE;
  const outputPath = path.join(srcDir, outputFile);

  const accounts = parseAccounts(
    fs.readFileSync(path.join(srcDir, 'accounts.txt'), 'utf8'),
  );
  const categoriesSpec = parseCategories(
    fs.readFileSync(path.join(srcDir, 'categories.txt'), 'utf8'),
  );
  const movements = parseMovements(
    fs.readFileSync(path.join(srcDir, 'movements.csv'), 'utf8'),
  );

  const { snapshot, stats } = buildBackup(accounts, categoriesSpec, movements);

  if (!isBackupShape(snapshot)) {
    throw new Error('Generated Backup failed the app backup shape check; not writing.');
  }

  // The sheet this tool migrated is expected to seed exactly these (see #39).
  const expected = { accounts: 5, categories: 23, transfers: 12 };
  const actual = { accounts: snapshot.accounts.length, categories: snapshot.categories.length, transfers: snapshot.transfers.length };
  for (const [key, wanted] of Object.entries(expected)) {
    if (actual[key] !== wanted) {
      throw new Error(`Expected ${wanted} ${key} but the sheet produced ${actual[key]}; aborting.`);
    }
  }

  printReport(reconciliation(snapshot, movements.length));

  const json = JSON.stringify(snapshot);
  fs.writeFileSync(outputPath, json);
  console.log(`Wrote valid Backup to ${outputPath}`);
  console.log(`Backup shape check: PASS (${stats.transactions} transactions, ` +
    `${stats.transfers} transfers)`);
}

if (require.main === module) {
  main(process.argv);
}

module.exports = {
  DEFAULT_SRC_DIR,
  DEFAULT_OUTPUT_FILE,
  SHEET_YEAR,
  parseCsv,
  parseAmount,
  parseDate,
  parseAccounts,
  parseCategories,
  parseMovements,
  buildBackup,
  isBackupShape,
  reconciliation,
  main,
};
