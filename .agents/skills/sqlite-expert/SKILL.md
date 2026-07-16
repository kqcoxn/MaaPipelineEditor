---
name: sqlite-expert
description: "SQLite expert for WAL mode, query optimization, embedded patterns, and advanced features"
---
# SQLite Expert

A database specialist with deep expertise in SQLite internals, performance tuning, and embedded database patterns. This skill provides guidance for using SQLite effectively in applications ranging from mobile apps and IoT devices to server-side caching layers and analytical workloads, leveraging its advanced features well beyond simple key-value storage.

## Key Principles

- Enable WAL mode (PRAGMA journal_mode=WAL) for concurrent read/write access; it allows readers to proceed without blocking writers and vice versa
- Use PRAGMA busy_timeout to set a reasonable wait duration (e.g., 5000ms) instead of receiving SQLITE_BUSY errors immediately on contention
- Design schemas with appropriate indexes from the start; SQLite's query planner relies heavily on index availability for efficient execution plans
- Keep transactions short and explicit; wrap related writes in BEGIN/COMMIT to ensure atomicity and reduce fsync overhead
- Understand that SQLite is serverless and single-file; its strength is simplicity and reliability, not high-concurrency multi-writer workloads

## Techniques

- Set performance PRAGMAs at connection open: journal_mode=WAL, synchronous=NORMAL, cache_size=-64000 (64MB), mmap_size=268435456, temp_store=MEMORY
- Use FTS5 for full-text search: CREATE VIRTUAL TABLE docs USING fts5(title, body) with MATCH queries and bm25() ranking
- Query JSON data with the JSON1 extension: json_extract(), json_each(), json_group_array() for document-style data stored in TEXT columns
- Write recursive CTEs (WITH RECURSIVE) for tree traversal, graph walking, and generating series of values
- Use window functions (ROW_NUMBER, LAG, LEAD, SUM OVER) for running totals, rankings, and time-series analysis without self-joins
- Create covering indexes that include all columns needed by a query to enable index-only scans (verified with EXPLAIN QUERY PLAN showing COVERING INDEX)
- Implement UPSERT with INSERT ... ON CONFLICT (column) DO UPDATE SET for atomic insert-or-update operations

## Common Patterns

- **Multi-database Access**: Use ATTACH DATABASE to query across multiple SQLite files in a single connection, joining tables from different databases
- **Application-defined Functions**: Register custom scalar or aggregate functions in your host language for domain-specific computations inside SQL queries
- **Incremental Vacuum**: Use PRAGMA auto_vacuum=INCREMENTAL with periodic PRAGMA incremental_vacuum to reclaim space without a full VACUUM lock
- **Schema Migration**: Use PRAGMA user_version to track schema version and apply migration scripts sequentially on application startup

## Pitfalls to Avoid

- Do not open multiple connections with different PRAGMA settings; WAL mode and other PRAGMAs should be set consistently on every connection
- Do not use SQLite for high-concurrency write workloads with dozens of simultaneous writers; consider PostgreSQL or another client-server database instead
- Do not store large BLOBs (over 1MB) inline; SQLite performs better when large objects are stored as external files with paths referenced in the database
- Do not skip EXPLAIN QUERY PLAN during development; without it, slow full-table scans go unnoticed until production load reveals them
