import React from 'react';

/**
 * Table - Compact themed table with sticky header, zebra rows and hover.
 * columns: [{ key, label, render?(row) }]
 * data: array of rows
 * keyField: unique key field in row, else fallback to index
 * emptyText: message when no data
 */

// PUBLIC_INTERFACE
export default function Table({ columns = [], data = [], keyField, emptyText = 'No data to display.' }) {
  /** Render a compact neon-styled table. */
  return (
    <div className="neon-table-wrapper">
      <table className="neon-table" role="table">
        <thead className="neon-table-head">
          <tr>
            {columns.map(col => (
              <th key={col.key} scope="col">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const rowKey = keyField ? row[keyField] : idx;
            return (
              <tr key={rowKey} className="neon-table-row">
                {columns.map(col => (
                  <td key={col.key}>
                    {typeof col.render === 'function' ? col.render(row) : prettify(row[col.key])}
                  </td>
                ))}
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="small muted" style={{ textAlign: 'center', padding: 16 }}>
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function prettify(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}
