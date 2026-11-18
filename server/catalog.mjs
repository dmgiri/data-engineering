import {readdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseCollection} from './import-collection.mjs';
import {parseStudyMaterial} from './import-study-material.mjs';

// Retained original practice and separately attributed, candidate-reported additions.
// Examples use PostgreSQL-flavoured SQL and current public APIs unless noted.
export const subjects = [
  { id: 'sql', name: 'SQL', short: 'SQL', color: '#5b91ef', description: 'Precise analytical SQL, dimensional modeling, correctness, and performance.' },
  { id: 'postgres', name: 'PostgreSQL', short: 'PG', color: '#6d9dc5', description: 'Production PostgreSQL internals, query plans, reliability, and operations.' },
  { id: 'python', name: 'Python', short: 'PY', color: '#dbb45a', description: 'Maintainable Python pipelines, concurrency, testing, and operational design.' },
  { id: 'pyspark', name: 'PySpark', short: 'SP', color: '#dc8d61', description: 'Distributed transformations, execution plans, streaming, and Spark diagnosis.' },
  { id: 'databricks', name: 'Databricks', short: 'DB', color: '#d67578', description: 'Delta Lake, governed lakehouses, reliable ingestion, orchestration, and cost.' },
  { id: 'architecture', name: 'Architecture', short: 'ARCH', color: '#8b7cc8', description: 'End-to-end data platforms, scalable pipelines, reliability, and architectural tradeoffs.' },
];

function question(subject, number, topic, title, type, minutes, prompt, answer, code, language, pitfalls, followups, sourceUrl, difficulty = 'Advanced') {
  return { id: `${subject}-${number}`, subject, topic, title, difficulty, type, minutes, prompt, answer, code, language, pitfalls, followups, sourceUrl };
}

const sql = [
  question('sql', 1, 'Window functions', 'Choose the latest record deterministically', 'Coding', 10,
    'An append-only order_events table contains duplicate deliveries and several updates with the same event timestamp. Return one latest event per order. Explain the ordering contract and how the solution changes for latest non-deleted orders.',
    [
      'First define latest using business event time, then add a stable, unique tie breaker such as source sequence and event ID. ROW_NUMBER partitions by order and orders the complete precedence tuple descending. Filter the rank in an outer query because WHERE runs before window evaluation. A maximum timestamp joined back to the table can return multiple rows, and an arbitrary tie breaker can hide a missing source ordering guarantee.',
      'For a current-state projection, rank all events before excluding tombstones; removing deletes first can resurrect an old order. Deduplicate repeated source event IDs separately when payload conflicts require quarantine. Index the partition and ordering columns for repeated point lookups, but inspect the plan for a full-table batch. Test equal timestamps, out-of-order arrivals, duplicate IDs, and an order whose latest event is a deletion.',
    ],
    `WITH ranked AS (
  SELECT e.*, ROW_NUMBER() OVER (
    PARTITION BY order_id
    ORDER BY event_at DESC, source_seq DESC, event_id DESC
  ) AS rn
  FROM order_events e
)
SELECT order_id, status, event_at
FROM ranked
WHERE rn = 1 AND operation <> 'DELETE';`, 'sql',
    ['Filtering tombstones before ranking resurrects deleted entities.', 'A timestamp alone does not provide deterministic precedence.'],
    ['What if the producer cannot supply a meaningful sequence?', 'How would you maintain this projection incrementally?'],
    'https://www.postgresql.org/docs/current/tutorial-window.html'),
  question('sql', 2, 'Window functions', 'Explain ROWS versus RANGE frames', 'Coding', 10,
    'Finance requests a running order total and a trailing seven-calendar-day revenue metric. Several orders share a timestamp and some dates have no orders. Design both calculations and explain frame semantics.',
    [
      'ROWS counts physical rows in the ordered partition; RANGE defines a value-based frame and includes peers sharing the ordering value. For a row-by-row running total, use an explicit ROWS frame and a deterministic ordering tuple. A default ordered frame may include every timestamp peer at once, producing repeated cumulative totals. LAST_VALUE also observes its frame, so its default can surprise someone expecting the final value of the entire partition.',
      'For calendar metrics, aggregate to the intended daily grain and join a date spine if missing days must appear as zero. Then choose a seven-day RANGE on the date or a seven-row frame only after ensuring exactly one row per date. State whether the metric is calendar days, elapsed hours, or business days. Test duplicate timestamps, sparse dates, partition boundaries, and daylight-saving transitions before presenting the result to finance.',
    ],
    `SELECT account_id, event_at, amount,
       SUM(amount) OVER (
         PARTITION BY account_id
         ORDER BY event_at, event_id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_amount
FROM payments;`, 'sql',
    ['Seven rows are not seven days when dates are sparse.', 'Implicit frames can include all peers unexpectedly.'],
    ['How would you calculate the final value for the entire partition?', 'What changes for seven business days?'],
    'https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS'),
  question('sql', 3, 'Joins and cardinality', 'Repair a join that doubles revenue', 'Debugging', 10,
    'Joining orders, order_items, payments, and customers makes reported revenue twice the ledger amount. How do you locate the fanout and produce revenue and payment metrics at customer-day grain?',
    [
      'Write down the grain and expected key of every input and the intended output. Orders to items and orders to payments are both one-to-many, so joining them directly creates item-payment combinations. Compare row counts and distinct order IDs after each join, then inspect multiplicity for representative orders. DISTINCT is usually a symptom cover: equal legitimate amounts can collapse, while differing duplicated columns still remain.',
      'Aggregate each many-side independently to one row per order before joining, or build separate customer-day aggregates and combine them at that shared grain. Preserve orders without payments with a left join and choose explicitly whether missing payment totals mean zero or unknown. Validate with reconciliation totals and adversarial examples containing multiple items, split payments, refunds, and customers with no activity. Add uniqueness checks for dimensions to prevent a future duplicate dimension key from reintroducing fanout.',
    ],
    `WITH item_totals AS (
  SELECT order_id, SUM(quantity * unit_price) AS revenue
  FROM order_items GROUP BY order_id
), payment_totals AS (
  SELECT order_id, SUM(amount) AS paid
  FROM payments GROUP BY order_id
)
SELECT o.customer_id, o.order_date,
       SUM(i.revenue) AS revenue, SUM(COALESCE(p.paid, 0)) AS paid
FROM orders o
JOIN item_totals i USING (order_id)
LEFT JOIN payment_totals p USING (order_id)
GROUP BY o.customer_id, o.order_date;`, 'sql',
    ['SUM(DISTINCT amount) loses legitimate equal-valued transactions.', 'A supposedly unique customer dimension can also cause fanout.'],
    ['How do partial refunds affect the grain?', 'Which automated assertions would detect this before release?'],
    'https://www.postgresql.org/docs/current/queries-table-expressions.html'),
  question('sql', 4, 'CTEs and query structure', 'Use CTEs without assuming a performance fence', 'Concept', 8,
    'A reviewer says every CTE materializes and makes queries slower. Evaluate that statement and explain when a CTE, derived table, temporary table, or persisted staging table is appropriate.',
    [
      'A CTE names an intermediate relation and improves readability; whether it is inlined or materialized depends on the database, version, references, and query properties. In PostgreSQL, eligible side-effect-free CTEs can be folded into the parent query, while MATERIALIZED and NOT MATERIALIZED offer explicit control in supported cases. Always inspect the actual plan instead of treating syntax as proof of an execution strategy.',
      'Use a derived table or CTE for a single composable transformation. A temporary table can support reuse, indexing, and statistics across statements, at the cost of storage, lifecycle management, and an extra write. Persist staging when restartability, auditing, or cross-job consumption matters. Materialization can help when an expensive calculation is reused, but hurt when it prevents selective predicates from reaching a large base table. Benchmark with representative data and include write and maintenance costs.',
    ], '', 'sql',
    ['Optimizer behavior differs across SQL engines and versions.', 'A readable query can still repeat an expensive expression after inlining.'],
    ['How would you confirm predicate pushdown?', 'When would temporary-table statistics change the join plan?'],
    'https://www.postgresql.org/docs/current/queries-with.html'),
  question('sql', 5, 'Recursive queries', 'Traverse a hierarchy safely', 'Coding', 12,
    'An employee table has employee_id and manager_id. Return everyone reporting to a selected manager, their depth, and their ancestry path. The source may contain cycles and orphaned managers.',
    [
      'A recursive CTE has an anchor selecting the starting node and a recursive term joining children to the previous frontier. Carry depth and a visited path so each branch can detect a repeated identifier. Specify whether the starting manager belongs in the output and whether a cycle should be reported or excluded. An index on manager_id supports child lookups; a depth limit is an additional operational safeguard, not a replacement for cycle handling.',
      'A tree traversal from one root will not discover unrelated orphans, so validate referential integrity in a separate quality check. Multiple parents turn the structure into a graph, where path-level cycle detection and global deduplication answer different questions. For heavily queried, slowly changing hierarchies, compare adjacency lists with closure tables or materialized paths. Test self-cycles, longer cycles, missing managers, deep chains, and branches with repeated display names.',
    ],
    `WITH RECURSIVE org AS (
  SELECT employee_id, manager_id, 0 AS depth,
         ARRAY[employee_id] AS path
  FROM employees WHERE employee_id = :root_id
  UNION ALL
  SELECT e.employee_id, e.manager_id, o.depth + 1,
         o.path || e.employee_id
  FROM employees e JOIN org o ON e.manager_id = o.employee_id
  WHERE NOT e.employee_id = ANY(o.path)
)
SELECT * FROM org ORDER BY path;`, 'sql',
    ['UNION alone may not break a cycle when depth or path changes each iteration.', 'An arbitrary maximum depth silently truncates valid hierarchies.'],
    ['How would you report the cycle rather than exclude it?', 'How would this change for a graph with multiple parents?'],
    'https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-RECURSIVE'),
  question('sql', 6, 'NULL and three-valued logic', 'Find entities absent from another table', 'Coding', 8,
    'Return customers who have never placed a non-cancelled order. An existing NOT IN query returns no rows after a NULL customer_id appears in orders. Explain and repair the query.',
    [
      'SQL comparisons with NULL usually produce unknown, and WHERE keeps only true results. NOT IN behaves like a conjunction of inequality comparisons, so a NULL in its subquery can make every unmatched customer evaluate to unknown. A correlated NOT EXISTS expresses the anti-join directly and is not poisoned by unrelated NULL values. Put the non-cancelled predicate inside the existence test because it defines which orders count.',
      'Decide separately how a NULL order status should behave: status <> cancelled also evaluates to unknown for NULL. Use an explicit predicate if unknown statuses count as active. A left anti-join is another option, but check a non-nullable right-side key after joining and keep right-side restrictions in ON. Test customers with no orders, only cancelled orders, mixed statuses, and source rows with NULL keys. Prefer constraints that prevent invalid keys at ingestion where the business contract permits them.',
    ],
    `SELECT c.customer_id
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o
  WHERE o.customer_id = c.customer_id
    AND o.status IS DISTINCT FROM 'cancelled'
);`, 'sql',
    ['Moving a right-table filter to WHERE can change a left join into an inner join.', 'NULL status treatment is a business rule, not a syntax detail.'],
    ['How does IS DISTINCT FROM differ from <>?', 'What would a correct LEFT JOIN version look like?'],
    'https://www.postgresql.org/docs/current/functions-subquery.html'),
  question('sql', 7, 'Set operations', 'Combine overlapping ingestion feeds', 'Concept', 8,
    'Two regional feeds overlap after a migration. Compare UNION, UNION ALL, INTERSECT, and EXCEPT, and design a reconciliation that preserves legitimate repeated events.',
    [
      'UNION ALL concatenates rows, while UNION removes duplicate complete rows and usually adds sorting or hashing work. INTERSECT returns shared rows and EXCEPT returns rows only in the first input; ALL variants preserve multiplicity according to each operator. Set operations compare projected row values, not business identity, so they cannot replace event-ID deduplication when records differ in ingestion metadata or when repeated equal-valued transactions are legitimate.',
      'Normalize types, column meanings, currency, and timestamp semantics before comparing feeds. Preserve the source and source event ID in raw storage, concatenate with UNION ALL, then apply an explicit precedence rule by logical event identity. Reconcile counts and sums by stable partitions and investigate both missing keys and conflicting payloads. Hashes can accelerate comparisons, but define canonical serialization and verify important mismatches with original fields. Parenthesize mixed set operations when precedence might obscure the intended result.',
    ],
    `SELECT event_id FROM old_feed
EXCEPT
SELECT event_id FROM new_feed;`, 'sql',
    ['UNION deduplicates entire rows rather than business keys.', 'Matching total counts do not establish row-level equivalence.'],
    ['How would you detect an event with the same ID but a changed payload?', 'When is EXCEPT ALL useful?'],
    'https://www.postgresql.org/docs/current/queries-union.html'),
  question('sql', 8, 'Aggregation', 'Build trustworthy subtotal metrics', 'Coding', 10,
    'Produce daily revenue by country, a daily total, and a grand total in one query. Explain NULL grouping labels and why averaging daily conversion rates gives the wrong overall conversion rate.',
    [
      'GROUPING SETS can calculate several aggregation grains in one statement. Use GROUPING to distinguish an actual NULL country from the placeholder NULL produced by a subtotal. State the input grain and ensure joins have not multiplied transactions before aggregation. COUNT(*) counts rows, whereas COUNT(column) counts non-NULL values, so the choice matters for conditional metrics and incomplete records.',
      'Ratios should generally be recomputed from additive numerators and denominators at the requested grain. Averaging daily conversion percentages gives a quiet day the same weight as a high-volume day. Return both counts and the resulting ratio, protect against a zero denominator, and define how cancelled or late events alter historical totals. Distinct-user measures are not additive across countries or days, so their subtotals require fresh distinct calculations or a consciously approximate mergeable sketch.',
    ],
    `SELECT day, country, GROUPING(day, country) AS subtotal_level,
       SUM(revenue) AS revenue,
       SUM(conversions)::numeric / NULLIF(SUM(visits), 0) AS conversion_rate
FROM daily_country_metrics
GROUP BY GROUPING SETS ((day, country), (day), ());`, 'sql',
    ['A NULL dimension value and a subtotal placeholder require different labels.', 'Distinct counts and percentages cannot simply be summed.'],
    ['When is an approximate distinct count acceptable?', 'How do you reconcile grand totals with a late-arriving correction?'],
    'https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-GROUPING-SETS'),
  question('sql', 9, 'Keys and constraints', 'Choose keys for a multi-tenant warehouse', 'Design', 10,
    'A source system guarantees order_id uniqueness only within a tenant. Design natural keys, warehouse surrogate keys, and constraints for orders and order lines, including historical source changes.',
    [
      'The source identity is the composite tenant_id and order_id, so every join and uniqueness rule must respect that scope. A warehouse surrogate key offers a stable compact reference and decouples fact tables from changing external identifiers, but it does not remove the need for a unique natural-key constraint. Model order-line identity separately, including the line identifier within its order rather than assuming line numbers are globally unique.',
      'Use foreign keys and NOT NULL constraints where supported and operationally appropriate, and validate equivalent contracts in lakehouse tables that do not enforce every relationship. Plan how source merges, rekeys, and tenant migrations map to historical identities. Historical dimension versions need a distinct version key while retaining the durable business key. Test cross-tenant ID collisions and ensure tenant restrictions propagate through access policies as well as SQL joins. A generated ID alone cannot prevent duplicate business records.',
    ], '', 'sql',
    ['A surrogate primary key does not enforce natural-key uniqueness.', 'Joining on order_id alone can leak or mix tenant data.'],
    ['How would you migrate facts after a source rekey?', 'Which constraints remain useful during bulk ingestion?'],
    'https://www.postgresql.org/docs/current/ddl-constraints.html'),
  question('sql', 10, 'Dimensional modeling', 'Model orders and inventory without mixed grain', 'Design', 12,
    'Design a warehouse for order-line revenue, inventory levels, and fulfilment milestones. Explain fact grains, dimensions, additive behavior, and how historical customer attributes should be joined.',
    [
      'Declare each fact grain before listing columns. Order-line transactions represent individual economic events; inventory snapshots represent a product-location balance at a chosen time; fulfilment can use an accumulating snapshot for milestones or an event fact for every state transition. Conformed date, product, and customer dimensions let consumers compare processes without combining incompatible facts row by row. Join independently aggregated facts at a shared grain to avoid fanout.',
      'Revenue is often additive across dates, while an inventory balance is semi-additive and should not be summed over time. Ratios and unit prices require recomputation from their components. Historical attributes should resolve to the dimension version valid at the fact event time, using non-overlapping validity intervals. Choose whether reports need historical truth or current reclassification and expose that distinction clearly. Document returns, currencies, late facts, and unknown dimension members as explicit modeling decisions.',
    ], '', 'sql',
    ['Putting transaction revenue and inventory balances in one fact obscures grain.', 'Joining historical facts to the current dimension silently rewrites history.'],
    ['How would you handle a late-arriving product dimension?', 'What changes for multi-currency revenue?'],
    'https://learn.microsoft.com/en-us/fabric/data-warehouse/dimensional-modeling-fact-tables'),
  question('sql', 11, 'Slowly changing dimensions', 'Implement temporal SCD type 2 joins', 'Coding', 12,
    'A customer dimension stores effective_from and effective_to for each version. Join purchases to the correct version, explain interval boundaries, and describe safe handling of a late historical change.',
    [
      'Use half-open intervals: effective_from is inclusive and effective_to is exclusive. A purchase exactly at a change timestamp then matches only the new version. Each business key should have no overlapping intervals, and there should be at most one current open-ended version. A surrogate version key belongs on the fact when reproducible historical joins matter. Track only attributes that require history; operational metadata changes need not create a new business version.',
      'A late change can split an existing interval and require reassigning facts for the affected time range. Do not simply expire the current row using the ingestion time if the business effective time is earlier. Stage and deduplicate changes, compute the desired interval sequence, and apply it atomically or with a recoverable versioned publication process. Validate overlap, gap policy, current-row uniqueness, and fact coverage. Preserve ingestion time separately to explain what was known at each processing date.',
    ],
    `SELECT f.purchase_id, d.customer_version_id
FROM purchases f
JOIN dim_customer d
  ON f.customer_id = d.customer_id
 AND f.purchased_at >= d.effective_from
 AND (f.purchased_at < d.effective_to OR d.effective_to IS NULL);`, 'sql',
    ['BETWEEN includes both boundaries and can match two adjacent versions.', 'Processing time and business effective time are different timelines.'],
    ['How would bitemporal reporting change the schema?', 'How do you repair already-loaded fact foreign keys?'],
    'https://learn.microsoft.com/en-us/fabric/data-warehouse/dimensional-modeling-dimension-tables'),
  question('sql', 12, 'Incremental processing', 'Design an incremental load that survives late data', 'Design', 12,
    'A daily ETL selects rows where updated_at exceeds the last successful timestamp. It occasionally misses updates and duplicates rows after retries. Redesign its extraction, merge, and checkpoint contract.',
    [
      'A timestamp watermark alone can miss ties, backdated updates, and transactions that commit after the extraction snapshot despite having earlier update timestamps. Prefer a source commit position or CDC log sequence when available. Otherwise extract an overlapping bounded window, deduplicate by business key and source version, and merge idempotently. Capture a fixed upper bound for each run so extraction is repeatable and progress is measurable.',
      'Publish the destination changes before advancing the checkpoint, ideally in one transaction or with an auditable batch manifest. A crash after writing but before checkpointing must cause a harmless replay. Include deletes through tombstones or a separate reconciliation path, and never infer deletion from absence in a partial extract. Monitor maximum observed lag and periodically compare source and destination partitions. Document the late-data limit and a backfill process for records older than the normal overlap window.',
    ], '', 'sql',
    ['A maximum updated_at does not prove all earlier transactions were extracted.', 'A full-snapshot deletion rule is unsafe for an incremental batch.'],
    ['How do you recover after checkpoint loss?', 'What guarantees improve when you can read a database log position?'],
    'https://www.postgresql.org/docs/current/logicaldecoding-explanation.html'),
  question('sql', 13, 'Time and calendars', 'Report local business days across DST', 'Coding', 10,
    'Transactions are stored as UTC instants. A business wants New York daily revenue, including daylight-saving transitions. Explain storage, filtering, grouping, and why a day is not always twenty-four hours.',
    [
      'Store event instants in an unambiguous timezone-aware representation and retain the source timezone when it has business meaning. Derive the reporting date by converting the instant to the business timezone, not by truncating UTC first. A local day around a daylight-saving change can span twenty-three or twenty-five elapsed hours. Construct local midnight boundaries in the named timezone and convert those boundaries to instants for half-open range filtering.',
      'Use IANA timezone names rather than fixed offsets so historical rules apply. Avoid applying a conversion function to every indexed timestamp in the filter when precomputed UTC bounds can use the index directly. If tenants have different reporting zones, a calendar dimension or precomputed business-date column may help, but define how timezone changes affect history. Test both DST boundaries, leap dates, ambiguous local input, and transactions exactly at midnight.',
    ],
    `SELECT (occurred_at AT TIME ZONE 'America/New_York')::date AS business_date,
       SUM(amount) AS revenue
FROM payments
WHERE occurred_at >= TIMESTAMP '2026-11-01 00:00:00' AT TIME ZONE 'America/New_York'
  AND occurred_at < TIMESTAMP '2026-11-02 00:00:00' AT TIME ZONE 'America/New_York'
GROUP BY 1;`, 'sql',
    ['A fixed UTC offset is wrong across daylight-saving transitions.', 'Casting to date before timezone conversion changes the reporting day.'],
    ['How would you process an ambiguous local timestamp from a CSV?', 'Would you store a business date physically?'],
    'https://www.postgresql.org/docs/current/datatype-datetime.html'),
  question('sql', 14, 'Metric design', 'Define retention before writing SQL', 'Design', 12,
    'Product asks for day-seven retention by acquisition cohort. Define the denominator, activity event, calendar interpretation, and late-event policy, then describe a reliable SQL implementation.',
    [
      'Clarify whether day-seven retention means activity exactly seven calendar days after signup, any activity within seven days, or activity on or after day seven. Define the cohort using a stable acquisition date and timezone, and state which users and activity events qualify. Build one row per eligible user in the cohort and one deduplicated row per user activity date; joining raw events can inflate the numerator.',
      'Compute retained users as a distinct eligible-user count and divide by the cohort population using numeric arithmetic and a zero-denominator guard. Exclude immature cohorts whose full observation window has not elapsed, or label them provisional. Late events can restate recent cohorts, so publish freshness and revision rules. Test duplicate activity, multiple devices, deleted accounts, bots, and users at timezone boundaries. The essential senior-level skill is making the metric contract reproducible before optimizing the query.',
    ], '', 'sql',
    ['An immature cohort can appear to have poor retention.', 'Counting events instead of users rewards unusually active users.'],
    ['How do anonymous-to-known identity merges affect historical retention?', 'Which cohort partitions would you recompute for late events?'],
    'https://www.postgresql.org/docs/current/functions-aggregate.html'),
  question('sql', 15, 'Pagination', 'Replace deep OFFSET pagination', 'Coding', 10,
    'An events API uses ORDER BY created_at DESC LIMIT 100 OFFSET 5000000. It is slow and returns inconsistent pages while new rows arrive. Propose cursor pagination with a complete ordering key.',
    [
      'OFFSET requires the database to walk past the skipped rows and can shift page boundaries when concurrent inserts or deletes occur. Keyset pagination uses the last seen ordering tuple as the next boundary. Add a unique tie breaker such as event_id because created_at alone cannot distinguish peers. Build a matching composite index and include tenant or account filters in the index design when those predicates scope every request.',
      'Encode the last tuple and relevant filter state into an opaque cursor, validate it, and keep the sort contract stable. Keyset pagination does not automatically provide a frozen snapshot: rows whose ordering values change may move between pages. For exports requiring exact snapshot consistency, use an appropriate snapshot or an immutable upper bound and discuss its retention cost. Reverse navigation requires reversing the comparison and query ordering, then restoring display order. Decide explicitly how NULL ordering values are handled.',
    ],
    `SELECT event_id, created_at, payload
FROM events
WHERE tenant_id = :tenant
  AND (created_at, event_id) < (:last_created_at, :last_event_id)
ORDER BY created_at DESC, event_id DESC
LIMIT 100;`, 'sql',
    ['A cursor without a unique tie breaker can omit peers.', 'Keyset pagination does not provide random access to page numbers.'],
    ['How would you paginate backward?', 'What consistency does a multi-hour export require?'],
    'https://www.postgresql.org/docs/current/queries-limit.html'),
  question('sql', 16, 'Query optimization', 'Tune a slow analytical query with evidence', 'Debugging', 12,
    'A previously fast customer revenue query now takes forty minutes. Explain your investigation before changing indexes, SQL, or compute size.',
    [
      'Start with the regression boundary: changed data volume, key distribution, schema, statistics, configuration, or query text. Capture an execution plan with actual rows, time, and buffer information in a safe environment. Find the earliest major mismatch between estimated and actual cardinality, then inspect scans, join algorithms, repeated loops, sorts, spills, and partition pruning. A large sequential scan can be optimal; an index is not automatically the answer.',
      'Reduce unnecessary rows and columns, remove accidental fanout, and make predicates usable by the engine. Refresh or improve statistics when estimates are wrong, and evaluate indexes against read benefit, write overhead, and storage. Benchmark one change at a time on representative distributions, checking result equivalence as well as elapsed time. Consider concurrency and cache state before declaring success. Record the original plan, new plan, and operational tradeoff so a later regression has a useful baseline.',
    ], '', 'sql',
    ['EXPLAIN ANALYZE executes the query, including side effects for writes.', 'A warm-cache benchmark may conceal production storage bottlenecks.'],
    ['What would a large estimated-versus-actual row mismatch suggest?', 'When is a sequential scan preferable to an index scan?'],
    'https://www.postgresql.org/docs/current/using-explain.html'),
  question('sql', 17, 'Data quality', 'Create checks that catch silent corruption', 'Design', 10,
    'Design SQL checks for an orders mart that can be green on row counts while still reporting wrong revenue. Include blocking rules, anomaly rules, and actionable failure details.',
    [
      'Cover structural contracts, relational contracts, and business reconciliation. Assert unique natural keys, required fields, valid ranges, referential coverage, and non-overlapping temporal dimension intervals. Reconcile counts and financial sums against an independent ledger at matching grain and currency. A count-only check misses duplicate-and-missing pairs and changed amounts. Return offending keys and bounded samples with each failure so the alert supports investigation rather than merely announcing a broken pipeline.',
      'Separate deterministic violations that block publication from statistical anomalies that require review. Compare freshness, volume, null rates, and distribution shifts with seasonality-aware baselines; static thresholds can flag every holiday while missing a slow degradation. Store check results with batch IDs, source versions, and expected tolerances. Quarantine malformed input where partial publication is acceptable, and state the completeness impact. Test the checks by injecting known duplicates, missing rows, skewed sums, and delayed partitions.',
    ],
    `SELECT tenant_id, order_id, COUNT(*) AS copies
FROM mart_orders
GROUP BY tenant_id, order_id
HAVING COUNT(*) > 1;`, 'sql',
    ['Equal total row counts can hide both missing and duplicate records.', 'Alerts without batch IDs or failing keys are hard to act on.'],
    ['Which failures should block a financial report?', 'How would you validate a check itself?'],
    'https://www.postgresql.org/docs/current/ddl-constraints.html'),
  question('sql', 18, 'Gaps and islands', 'Identify consecutive active-day streaks', 'Coding', 12,
    'Find each user’s consecutive calendar-day activity streaks and the longest streak. Multiple events can occur on one day and inactive days do not appear in the source.',
    [
      'First deduplicate to user and activity date in the required business timezone. Within each user, subtract an increasing row number from the date; consecutive dates share the same resulting island key. Group by that key to obtain the streak start, end, and day count, then rank streaks with a deterministic tie rule. Deduplication must occur before numbering, otherwise multiple events on a day break the date-row-number relationship.',
      'This approach measures calendar-day continuity, not elapsed twenty-four-hour intervals. For a different gap threshold, use LAG to identify breaks and a cumulative SUM of the break flag to form groups. Decide whether a streak ending today is considered open and whether partial ingestion can temporarily break it. Test one-day streaks, repeated dates, leap days, and timezone boundaries. Add a date spine only if the output must explicitly display inactive days or continuity across a business-day calendar.',
    ],
    `WITH days AS (
  SELECT DISTINCT user_id, activity_date FROM activity
), numbered AS (
  SELECT *, activity_date - (ROW_NUMBER() OVER (
    PARTITION BY user_id ORDER BY activity_date
  ))::integer AS island
  FROM days
)
SELECT user_id, MIN(activity_date) AS start_date,
       MAX(activity_date) AS end_date, COUNT(*) AS streak_days
FROM numbered GROUP BY user_id, island;`, 'sql',
    ['Numbering raw events breaks the island key.', 'Business-day streaks need a business calendar index.'],
    ['How would you allow a single missed day?', 'How would you choose the latest among equal-length streaks?'],
    'https://www.postgresql.org/docs/current/functions-window.html'),
  question('sql', 19, 'Sessionization', 'Sessionize out-of-order user events', 'Coding', 12,
    'Create sessions separated by more than thirty minutes of inactivity. Events can arrive late and timestamps can tie. Explain batch SQL and the impact of incremental recomputation.',
    [
      'Sort each user’s events by event time and a stable event ID. LAG provides the previous event time; mark a new session for the first event or a gap greater than the agreed threshold. Cumulatively sum that flag using an explicit ROWS frame to assign a session group. Define the exact thirty-minute boundary and deduplicate repeated event IDs first. Group the result for start time, end time, event count, and duration.',
      'Late events can connect two previously separate sessions, so a simple append-only assignment is incorrect. Recompute an affected user-time range with enough boundary context, and choose whether published session IDs may change. A session-start event ID can provide a useful identifier, but even that can change after earlier data arrives. Separate finalization from provisional results using an allowed lateness policy. Test tied timestamps, events exactly at the threshold, overnight sessions, and a late bridge event.',
    ],
    `WITH previous AS (
  SELECT *, LAG(event_at) OVER (
    PARTITION BY user_id ORDER BY event_at, event_id
  ) AS prev_at FROM events
), breaks AS (
  SELECT *, CASE WHEN prev_at IS NULL
    OR event_at - prev_at > INTERVAL '30 minutes' THEN 1 ELSE 0 END AS new_session
  FROM previous
)
SELECT *, SUM(new_session) OVER (
  PARTITION BY user_id ORDER BY event_at, event_id
  ROWS UNBOUNDED PRECEDING
) AS session_number FROM breaks;`, 'sql',
    ['Late bridge events can merge two old sessions.', 'An incremental partition needs context from the previous partition.'],
    ['How would you make session identifiers stable for downstream consumers?', 'When can a session be considered final?'],
    'https://www.postgresql.org/docs/current/functions-window.html'),
  question('sql', 20, 'Transactional loading', 'Make batch publication idempotent', 'Design', 12,
    'An orchestrator retries a batch after a network timeout, but cannot tell whether the database committed. Design a load that does not duplicate facts and exposes complete batches to readers.',
    [
      'Assign a stable batch ID and stable business event IDs before writing. Stage the batch, validate it, and commit the target changes and a unique batch-ledger record in one transaction when the database permits it. On retry, inspect or insert that same ledger key rather than creating a new batch identity. Unique constraints and conflict handling enforce the invariants under concurrency; an application-side existence check alone has a race.',
      'A lost commit acknowledgement creates an uncertain outcome, so reconnect and query the ledger instead of assuming failure. For publication across systems without a shared transaction, use versioned outputs and an atomic manifest or an outbox pattern, then make each consumer idempotent. Record counts, checksums, source offsets, and load status for reconciliation. Avoid treating a partially extracted source partition as a complete replacement. Test failures before commit, after commit, during acknowledgement, and during concurrent retries.',
    ], '', 'sql',
    ['Generating a new batch ID on retry defeats deduplication.', 'Check-then-insert without a unique constraint is race-prone.'],
    ['How would an outbox help publish a downstream notification?', 'Which metadata must be committed with a source checkpoint?'],
    'https://www.postgresql.org/docs/current/tutorial-transactions.html'),
];

const postgres = [
  question('postgres', 1, 'MVCC', 'Explain snapshots and dead tuples', 'Concept', 10,
    'A reporting transaction continues to see an old customer value after another transaction commits an update. Explain MVCC, visibility, isolation-level differences, and the operational cost of long-running snapshots.',
    [
      'PostgreSQL stores multiple tuple versions so readers can see a consistent snapshot without normally blocking writers of the same rows. An update creates a new row version and leaves the previous version for transactions that may still need it. At Read Committed, each statement gets a new snapshot; Repeatable Read keeps a transaction-level snapshot. Therefore seeing an old value can be expected snapshot behavior rather than replication lag or a failed commit.',
      'Obsolete versions become reclaimable only after no relevant snapshot needs them. Long transactions, idle transactions, and replication-related retention can delay cleanup, increasing table and index bloat and transaction-ID pressure. Monitor transaction age, backend state, and vacuum progress before terminating work. Keep application transactions short and avoid opening a snapshot while performing slow network calls. Explain visibility separately from durability: WAL protects committed changes, while MVCC controls which version a reader can observe.',
    ], '', 'sql',
    ['Read Committed does not guarantee the same snapshot across two statements.', 'An idle-in-transaction client can retain old versions for hours.'],
    ['How does a long-running read affect vacuum?', 'Why does MVCC not eliminate all locking?'],
    'https://www.postgresql.org/docs/current/mvcc-intro.html'),
  question('postgres', 2, 'Vacuum and storage', 'Diagnose autovacuum falling behind', 'Debugging', 12,
    'A frequently updated table grows rapidly although its live row count is stable. Describe vacuum, analyze, freezing, bloat, and safe recovery options.',
    [
      'Updates and deletes leave tuple versions that ordinary VACUUM can mark reusable once they are no longer visible to any relevant transaction. VACUUM generally makes space reusable within the relation rather than shrinking the file; ANALYZE updates planner statistics and is a separate concern. Freezing old transaction IDs prevents wraparound visibility problems, making vacuum a correctness requirement as well as a performance task.',
      'Inspect dead-tuple estimates, autovacuum history, long transaction horizons, replication slots, and table-specific churn. Tune thresholds and worker capacity for large hot tables rather than relying on defaults designed for average workloads. Fix retention blockers before repeatedly launching manual vacuum. VACUUM FULL rewrites the table and requires a strong lock, so plan disk headroom and downtime or choose an appropriate online rewrite strategy. Verify write amplification, query latency, and cleanup progress after intervention instead of judging success only by file size.',
    ], '', 'sql',
    ['Ordinary VACUUM is not a promise to return most disk space to the OS.', 'Aggressive cleanup cannot reclaim versions still needed by old snapshots.'],
    ['When would table-level autovacuum settings help?', 'How would you investigate transaction-ID wraparound risk?'],
    'https://www.postgresql.org/docs/current/routine-vacuuming.html'),
  question('postgres', 3, 'Index design', 'Choose an index from the access pattern', 'Design', 12,
    'A multi-tenant orders table supports recent open-order lookups and broad time-range scans. Compare composite B-tree, partial, covering, BRIN, and GIN indexes, including their write costs.',
    [
      'Design a composite B-tree around the actual equality, range, and ordering predicates, such as tenant followed by creation time and a deterministic ID. A partial index can target open orders when the query predicate implies its condition. INCLUDE columns may enable index-only scans, but visibility-map coverage and update churn still matter. Every additional index consumes storage and adds work to inserts, deletes, vacuum, and some updates.',
      'BRIN is compact and useful when a very large table has strong physical correlation with the range key; it returns candidate block ranges rather than pinpointing every row. GIN supports inverted lookups such as JSONB containment or arrays, with different maintenance costs. Inspect selectivity and plans under representative tenant sizes before choosing. Build large production indexes concurrently when appropriate, account for its restrictions and possible invalid indexes after failure, and measure the benefit against the ongoing write budget.',
    ],
    `CREATE INDEX CONCURRENTLY orders_open_recent
ON orders (tenant_id, created_at DESC, order_id DESC)
INCLUDE (total_amount)
WHERE status = 'open';`, 'sql',
    ['A partial index is usable only when the planner can establish its predicate.', 'INCLUDE does not guarantee an index-only scan on a frequently updated table.'],
    ['How do prepared parameters affect a partial-index predicate?', 'When would a BRIN index beat a much larger B-tree?'],
    'https://www.postgresql.org/docs/current/indexes.html'),
  question('postgres', 4, 'Execution plans', 'Read an EXPLAIN ANALYZE plan', 'Debugging', 12,
    'A nested-loop join performs millions of inner scans and a sort spills to disk. Explain how you would read EXPLAIN (ANALYZE, BUFFERS), estimate the cause, and test a correction.',
    [
      'Read the plan from the scans upward and locate the first substantial estimated-versus-actual row mismatch. For repeated nodes, actual rows and time are reported per loop, so multiply by loops when judging total work. BUFFERS distinguishes shared hits, reads, and temporary I/O; a cache hit is still CPU and memory work. A nested loop can be excellent for a small outer relation with efficient indexed probes, but disastrous when cardinality was underestimated.',
      'Check stale or insufficient statistics, correlated predicates, hidden casts, missing indexes, and accidental fanout. A spilling sort may benefit from fewer input rows or a carefully scoped work_mem adjustment, but each node and worker can allocate memory, so raising it globally is risky. Compare plans and end-to-end latency after one targeted change. EXPLAIN ANALYZE actually executes the statement, so use special care with modifications, triggers, and external side effects.',
    ],
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT o.order_id, c.segment
FROM orders o JOIN customers c USING (customer_id)
WHERE o.created_at >= CURRENT_DATE - INTERVAL '7 days';`, 'sql',
    ['Ignoring loops can understate a repeated inner scan by orders of magnitude.', 'Increasing work_mem globally can multiply memory demand across sessions.'],
    ['How would you distinguish bad estimates from slow storage?', 'What evidence would justify a different join algorithm?'],
    'https://www.postgresql.org/docs/current/using-explain.html'),
  question('postgres', 5, 'Planner statistics', 'Fix estimates for correlated columns', 'Debugging', 10,
    'A query filtering country and postal_code estimates ten rows but returns five million. Explain ordinary statistics, extended statistics, statistics targets, and when ANALYZE is insufficient.',
    [
      'The planner estimates selectivity from sampled statistics, including null fractions, common values, histograms, and distinct-count estimates. Independent column estimates can be badly wrong when columns are correlated, as country and postal code often are. Extended statistics can describe dependencies, multicolumn distinctness, or combinations of common values for supported estimation cases. A higher statistics target can improve coverage of a skewed distribution at additional analyze and catalog cost.',
      'First confirm the table was analyzed after a major load and inspect whether the relevant values are represented. Create targeted extended statistics and rerun ANALYZE, then compare estimated and actual rows. Statistics cannot fix an incorrect join, nonselective requirement, or every expression and cross-table correlation. Parameter-sensitive workloads may also behave differently under generic and custom plans. Keep a representative workload and monitor plan regressions instead of globally forcing a scan or join strategy.',
    ],
    `CREATE STATISTICS address_dependencies (dependencies, mcv)
ON country, postal_code FROM addresses;
ANALYZE addresses;`, 'sql',
    ['Fresh single-column statistics may still miss cross-column correlation.', 'Extended statistics are not a universal cross-table join estimator.'],
    ['When would you raise a column statistics target?', 'How can a generic prepared plan behave differently for a huge tenant?'],
    'https://www.postgresql.org/docs/current/planner-stats.html'),
  question('postgres', 6, 'Locks and deadlocks', 'Resolve a blocking chain safely', 'Debugging', 12,
    'A schema migration is waiting, application requests pile up, and a deadlock appears in logs. Explain lock waits, deadlocks, investigation queries, and prevention.',
    [
      'A lock wait is a dependency on another transaction; a deadlock is a cycle of dependencies that PostgreSQL detects and resolves by aborting one participant. Use pg_stat_activity, pg_locks, and pg_blocking_pids to identify the root blocker, its transaction age, and the statements involved. A waiting strong DDL lock can cause subsequent compatible application work to queue behind it, so the apparent migration wait can become a broader outage.',
      'Avoid killing random waiting sessions. Determine whether the blocker can finish, cancel its statement, or terminate its transaction under an operational runbook. Set sensible lock and statement timeouts for migrations and application workloads. Acquire multiple resources in a consistent order, keep transactions short, and retry whole transactions after deadlock errors with bounded backoff. Rehearse DDL against realistic table sizes because a syntactically small change may require a rewrite or an expensive validation scan.',
    ],
    `SELECT pid, state, xact_start, wait_event_type, wait_event,
       pg_blocking_pids(pid) AS blockers, query
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY xact_start NULLS LAST;`, 'sql',
    ['Cancelling a statement may leave its transaction open until the client rolls back.', 'A waiting DDL lock can amplify blocking even before it is granted.'],
    ['How do you retry a deadlock victim safely?', 'Which migration timeouts would you set and why?'],
    'https://www.postgresql.org/docs/current/explicit-locking.html'),
  question('postgres', 7, 'Isolation', 'Prevent write skew in a business invariant', 'Scenario', 12,
    'Two on-call engineers each see that the other is available and independently set themselves off call. Explain why Repeatable Read can allow this and compare row locking with Serializable isolation.',
    [
      'Snapshot isolation can give both transactions a consistent view while still allowing write skew when they update different rows. Each transaction reads a predicate about the whole group and writes only its own row, so there is no direct row-write conflict. PostgreSQL Serializable tracks read-write dependencies and can abort a transaction when the concurrent execution cannot be serialized. Applications must treat serialization failures as expected retryable outcomes.',
      'Another design is to lock a stable parent row representing the on-call group, then check and update the invariant inside that transaction. Locking only rows currently matching a predicate may not protect every insert or changing membership case. A declarative constraint is preferable when it can express the invariant. Retry the entire transaction, including reads, with bounded backoff and no duplicated external effects. Test concurrent execution deliberately; sequential unit tests cannot demonstrate that the invariant is protected.',
    ], '', 'sql',
    ['A consistent snapshot does not imply serial execution.', 'Retrying only the final UPDATE reuses decisions made from a stale snapshot.'],
    ['How would an outbox handle an email sent during a retried transaction?', 'Which invariants fit a unique or exclusion constraint instead?'],
    'https://www.postgresql.org/docs/current/transaction-iso.html'),
  question('postgres', 8, 'Partitioning', 'Partition a large event table for retention', 'Design', 12,
    'Design partitioning for a ten-terabyte event table with ninety-day retention and queries by tenant and event time. Discuss pruning, indexes, uniqueness, maintenance, and late events.',
    [
      'Range partitioning by event date can align pruning and retention with the workload. Queries need compatible predicates on the partition key; partitioning does not automatically accelerate a tenant-only lookup. Choose daily or monthly partitions from data volume, retention operations, and planning overhead rather than creating thousands of tiny partitions. Each partition still needs an appropriate index strategy, and partitioned-table uniqueness requirements constrain which global keys can be enforced.',
      'Automate future partition creation and test late or out-of-range data handling. Detaching or dropping old partitions can be cheaper than deleting billions of rows, but dependencies, locks, backups, and recovery obligations still matter. Keep statistics current on relevant relations and verify pruning in actual plans. A default partition can prevent ingestion failure but may accumulate forgotten data and complicate later attachments. Plan how updates that change the partition key, backfills, and schema changes are handled before production growth makes them expensive.',
    ], '', 'sql',
    ['A partition key absent from common filters limits pruning benefits.', 'A default partition is not a substitute for automated partition maintenance.'],
    ['What unique-key restriction does a partitioned table impose?', 'How would you backfill data older than retention?'],
    'https://www.postgresql.org/docs/current/ddl-partitioning.html'),
  question('postgres', 9, 'WAL and durability', 'Explain the commit durability path', 'Concept', 10,
    'Explain how a PostgreSQL commit becomes durable, how checkpoints differ from commits, and the tradeoffs of asynchronous commit and unlogged staging tables.',
    [
      'Write-ahead logging records recovery information before dirty data pages need to reach durable storage. A normal durable commit waits for the required WAL flush according to configuration, while table pages can be written later. Checkpoints bound recovery work by establishing a known recovery position and flushing dirty state; they are not a commit for each transaction. WAL volume also drives replication traffic, archival storage, and recovery requirements.',
      'Asynchronous commit can acknowledge before the local WAL is durably flushed, accepting a bounded risk of losing recent acknowledged transactions after a crash. Unlogged tables avoid normal table-data WAL but are not crash-safe and are unsuitable as the only copy of business data or for ordinary replication expectations. They can fit reconstructable staging. Evaluate these choices against recovery objectives, not just throughput. Monitor WAL generation, checkpoint pressure, archive failures, and retained WAL before a bulk load overwhelms disk capacity.',
    ], '', 'sql',
    ['A checkpoint is not required for every committed transaction to survive a crash.', 'Unlogged staging must be reproducible after a crash.'],
    ['How does synchronous replication change commit latency?', 'Why can one abandoned replication slot fill a disk?'],
    'https://www.postgresql.org/docs/current/wal-intro.html'),
  question('postgres', 10, 'Replication', 'Choose physical versus logical replication', 'Design', 12,
    'A team wants a read replica, selective change feeds, and a major-version migration. Compare physical and logical replication, including lag, slots, schema changes, and failover.',
    [
      'Physical replication replays WAL to maintain a cluster-level replica and is a natural fit for standby recovery and read scaling within its compatibility constraints. Logical replication publishes row-level changes for selected tables and supports selective integration and migration use cases, but requires explicit attention to table identity, initial synchronization, schema compatibility, and unsupported or separately managed objects. Neither choice makes a replica instantly current.',
      'Measure lag in terms relevant to the business: WAL positions, replay delay, and the freshness of specific data. Replication slots retain required WAL and can exhaust storage when a consumer falls behind or disappears. Logical DDL and sequence behavior need a migration plan rather than assuming every database change is automatically copied. Define failover fencing, client reconnection, replica read-after-write expectations, and how consumers resume without losing or duplicating changes. Rehearse failure and promotion with realistic workloads.',
    ], '', 'sql',
    ['Logical replication does not automatically reproduce every DDL operation.', 'A retained replication slot can consume unbounded storage without monitoring.'],
    ['How would an API provide read-your-writes consistency?', 'What must be validated before promoting a replica?'],
    'https://www.postgresql.org/docs/current/logical-replication.html'),
  question('postgres', 11, 'Backup and recovery', 'Prove point-in-time recovery works', 'Design', 12,
    'An accidental DELETE committed at 10:03. You have a base backup and WAL archives. Describe a point-in-time recovery plan and how you would prove the recovery objectives are achievable.',
    [
      'PITR needs a usable base backup plus the continuous WAL needed from that backup to the desired recovery target. Restore into an isolated instance, configure archive recovery and a target before the bad transaction, then validate the recovered state before exposing it. A timestamp is convenient but a transaction or WAL position can provide a more precise target when known. Keep the original system available for investigation and avoid overwriting the only remaining good evidence.',
      'Recovery-point objectives depend on archive continuity and lag, while recovery-time objectives include provisioning, downloading, replaying WAL, verification, and application cutover. Regularly rehearse restores, verify backup integrity, and alert on archive failures and retention gaps. Database recovery does not automatically undo external emails, object-store writes, or downstream events, so plan reconciliation. If only one table needs repair, an isolated recovery can provide rows for a carefully audited corrective load rather than forcing whole-system rollback.',
    ], '', 'sql',
    ['A successful backup job does not prove the backup can be restored.', 'Missing one required WAL segment can break the intended recovery chain.'],
    ['How would you estimate WAL replay time?', 'How would you reconcile downstream systems after restoring an earlier database state?'],
    'https://www.postgresql.org/docs/current/continuous-archiving.html'),
  question('postgres', 12, 'Bulk ingestion', 'Load a large CSV safely with COPY', 'Design', 10,
    'Load a two-hundred-gigabyte partner CSV into production with validation, restartability, and minimal disruption. Explain COPY, staging, indexes, constraints, and malformed records.',
    [
      'Use COPY or a client-side COPY protocol for efficient bulk transfer, but load into a controlled staging relation rather than directly trusting the file. Declare encoding, delimiter, quoting, NULL representation, and column order explicitly. Validate a manifest, expected file size, and checksum before loading. For unreliable source typing, stage as text and validate conversions separately so a malformed business value can be diagnosed without silently changing it.',
      'Associate staged rows with a stable batch ID, reconcile counts and business totals, then merge or publish through an atomic transaction or partition operation. Consider how existing indexes, foreign keys, WAL, replication, and disk headroom affect throughput; postponing indexes can help a fresh table but changes availability and validation sequencing. Split work into independently identifiable files if restartability is required. Record rejected rows and protect sensitive payloads in logs. Test quoted newlines, empty strings, NULL tokens, and interrupted client connections.',
    ],
    `COPY staging_orders (order_id, amount_text, occurred_at_text)
FROM STDIN WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');`, 'sql',
    ['An empty string and a NULL token can mean different things in CSV.', 'Server-side COPY file paths refer to the database server, not the client.'],
    ['How would you resume after half the files loaded?', 'When could a partition swap reduce publication time?'],
    'https://www.postgresql.org/docs/current/sql-copy.html'),
  question('postgres', 13, 'JSONB', 'Use JSONB without losing relational guarantees', 'Design', 10,
    'A product team wants every customer attribute stored in one JSONB column. Explain suitable uses, extraction and indexing, type behavior, and which fields deserve normal columns.',
    [
      'JSONB is useful for flexible, sparse, or evolving attributes, but core identifiers, join keys, stable filter fields, and constrained business values often deserve typed columns. A JSON document does not replace relational constraints or a clear schema contract. Distinguish a missing key, JSON null, and SQL NULL, and use the appropriate extraction operator when text versus JSON semantics matter. Repeated casts in queries can hide invalid payloads and complicate index use.',
      'Choose a GIN index and operator class for the actual containment or path predicates, or an expression index for a frequently filtered extracted value. Avoid indexing every possible attribute without workload evidence; large documents and indexes increase write and storage costs. Validate important shapes during ingestion and promote hot attributes to typed columns as the access pattern stabilizes. Test mixed numeric and string values, absent keys, nested arrays, and updates that rewrite large documents under high concurrency.',
    ],
    `CREATE INDEX customers_country
ON customers ((profile ->> 'country'));
SELECT customer_id FROM customers
WHERE profile ->> 'country' = 'IN';`, 'sql',
    ['The string "42" and numeric 42 are different JSON values.', 'One generic JSON index does not accelerate every extraction expression.'],
    ['When would you choose a generated column?', 'How do JSON null and a missing key differ in your application contract?'],
    'https://www.postgresql.org/docs/current/datatype-json.html'),
  question('postgres', 14, 'Roles and security', 'Design least-privilege database access', 'Design', 10,
    'Separate ingestion, transformation, reporting, and administration access for a multi-tenant database. Cover ownership, default privileges, row-level security, and secrets.',
    [
      'Separate login roles from group roles that carry privileges, and keep object ownership with controlled deployment roles rather than application logins. Grant only required schema usage, table operations, and sequence privileges. Define default privileges for the role that will actually create future objects; existing grants alone do not secure tomorrow’s tables. Use parameterized queries and managed secret rotation because role design cannot compensate for injection or leaked credentials.',
      'Row-level security can enforce tenant restrictions, but owners and privileged roles have bypass behavior that must be understood and tested. Session tenant context must be set and reset safely when connections are pooled. Limit access to privileged functions and review search_path risks for SECURITY DEFINER code. Audit both grants and effective behavior using realistic application identities. Keep operational administration separate from routine reporting, and ensure logs and exports do not become an alternate route around database access policies.',
    ], '', 'sql',
    ['Default privileges apply according to the object-creating role.', 'A pooled connection can leak tenant session state if it is not reset.'],
    ['How would you test RLS using the actual application role?', 'Why is function search_path part of the security review?'],
    'https://www.postgresql.org/docs/current/ddl-rowsecurity.html'),
  question('postgres', 15, 'Connection pooling', 'Stop connection storms without hiding overload', 'Scenario', 10,
    'Hundreds of workers each open a PostgreSQL connection and latency collapses. Propose a pool design, sizing method, timeout policy, and implications of transaction pooling.',
    [
      'A connection is not a free unit of parallelism: too many active sessions compete for CPU, memory, locks, and storage. Bound application concurrency and use a pool with a finite queue and explicit acquisition timeout. Size from measured database capacity and transaction service time, not from the number of application threads. Track active work, pool wait time, transaction duration, and rejection rate so the pool exposes backpressure rather than hiding an overloaded database.',
      'Transaction pooling can multiplex many clients onto fewer server connections, but session-level state may not survive between transactions. Review temporary tables, advisory locks, SET commands, prepared statements, and driver behavior against the actual pooler capabilities and configuration. Keep network calls outside transactions and set statement, lock, and idle-transaction limits deliberately. Ensure every error path rolls back or discards a bad connection before returning it. Test a worker burst and a slow database dependency to verify graceful degradation.',
    ], '', 'sql',
    ['Increasing max_connections can worsen contention instead of increasing throughput.', 'Session state assumptions can break under transaction pooling.'],
    ['Which pool metrics distinguish saturation from slow SQL?', 'How would you reserve capacity for administrative recovery?'],
    'https://www.postgresql.org/docs/current/runtime-config-connection.html'),
  question('postgres', 16, 'Functions and transactions', 'Choose SQL functions or application logic', 'Design', 10,
    'An ETL repeatedly executes row-by-row PL/pgSQL functions. Discuss set-based alternatives, function volatility, security, exception handling, and when database-side logic is appropriate.',
    [
      'Prefer set-based operations when a transformation can be expressed as joins, aggregates, and bulk updates; repeated function calls can add overhead and obscure work from the optimizer. Database-side functions are valuable when they centralize invariants or reduce round trips close to the data. Declare volatility accurately: IMMUTABLE, STABLE, and VOLATILE are promises the planner uses, not tuning hints to apply optimistically.',
      'Review transaction boundaries, exception semantics, and the cost of per-row exception blocks before moving a pipeline into procedural code. SECURITY DEFINER functions need tightly controlled privileges, a safe search_path, and careful input validation. Keep external orchestration, retries, and non-database side effects in a layer with explicit operational control unless there is a strong reason otherwise. Benchmark the complete workload, including locks and plan reuse. Test NULL inputs, malformed data, concurrent callers, and permission behavior under the intended application role.',
    ], '', 'sql',
    ['Mislabeling a function IMMUTABLE can produce incorrect cached results.', 'Catching every exception can hide a partially successful or invalid load.'],
    ['When does a SQL-language function inline?', 'How would you safely expose a privileged transformation to an ingestion role?'],
    'https://www.postgresql.org/docs/current/xfunc-volatility.html'),
  question('postgres', 17, 'Views and materialized views', 'Serve a costly aggregate reliably', 'Design', 10,
    'A dashboard repeatedly calculates an expensive daily aggregate. Compare a view, materialized view, and incrementally maintained summary table, including freshness and concurrent refresh.',
    [
      'A normal view stores a query definition and presents current underlying data according to transaction visibility; it does not inherently cache the result. A materialized view persists results and trades freshness for faster reads and additional refresh work. Concurrent materialized-view refresh has prerequisites, including an appropriate unique index, and still consumes resources. It should be scheduled and monitored as a real workload rather than assumed free background maintenance.',
      'An incrementally maintained summary can update only affected partitions, but must handle duplicates, corrections, deletes, and late events with explicit idempotency. Choose from the freshness requirement, refresh cost, failure recovery, and query latency target. Expose the data-as-of time and publish updates atomically so readers do not see mixed refresh states. Validate summary totals against source facts periodically. For a modest dataset, improving the base query and indexes may be simpler than adding a new derived-state lifecycle.',
    ], '', 'sql',
    ['A normal view is not a stored result cache.', 'A materialized-view refresh can compete heavily with production queries.'],
    ['How would late corrections update a daily summary?', 'What unique index does concurrent refresh require?'],
    'https://www.postgresql.org/docs/current/rules-materializedviews.html'),
  question('postgres', 18, 'Upserts and contention', 'Use ON CONFLICT with a version contract', 'Coding', 10,
    'Multiple ingestion workers upsert customer changes, sometimes out of order. Design a unique key and ON CONFLICT statement that avoids overwriting a newer value with an older event.',
    [
      'Enforce the true business key with a unique constraint, then use INSERT ON CONFLICT so the conflict decision and write are coordinated by PostgreSQL rather than an application check-then-insert race. Include a comparable source version in each row and update only when the incoming version is newer. Define how equal-version, different-payload records are detected; silently accepting either value can hide source corruption.',
      'Deduplicate a batch by key and precedence before the statement because one statement must not attempt incompatible repeated updates of the same target row. Highly contended keys still serialize and can cause lock waits, so spread independent work and keep transactions bounded. Decide whether tombstones participate in version ordering so stale updates cannot revive deleted entities. Make retry behavior idempotent and test interleaved workers, equal versions, delayed events, and a network timeout after commit.',
    ],
    `INSERT INTO customers AS target (tenant_id, customer_id, name, source_version)
VALUES (:tenant, :customer, :name, :version)
ON CONFLICT (tenant_id, customer_id) DO UPDATE
SET name = EXCLUDED.name, source_version = EXCLUDED.source_version
WHERE EXCLUDED.source_version > target.source_version;`, 'sql',
    ['Upsert does not solve an undefined source ordering contract.', 'Repeated keys within one batch require deterministic preprocessing.'],
    ['How would you preserve a deletion version?', 'What would you do with equal-version conflicting payloads?'],
    'https://www.postgresql.org/docs/current/sql-insert.html'),
  question('postgres', 19, 'Work queues', 'Build a bounded SKIP LOCKED worker queue', 'Coding', 12,
    'Several workers must claim jobs from a PostgreSQL queue without processing the same job concurrently. Design a claim query, lease and retry policy, and explain what SKIP LOCKED does not guarantee.',
    [
      'Use a short transaction that selects eligible rows with FOR UPDATE SKIP LOCKED, marks them claimed with an owner and lease deadline, and returns the claimed jobs. Row locks prevent concurrent claimers from choosing the same row during the claim transaction; SKIP LOCKED lets other workers continue past already locked rows. It produces an intentionally incomplete view and is suitable for a queue, not a consistent financial report.',
      'Do the slow job outside the claim transaction, then acknowledge with a conditional update that checks the lease token. A reaper can return expired leases to the queue, so processing must be idempotent and attempts bounded. Use a stable external idempotency key for side effects and dead-letter repeated failures. Monitor oldest eligible age to detect starvation, and index the eligibility predicates. A database claim does not provide exactly-once external execution after a worker crashes between the side effect and acknowledgement.',
    ],
    `WITH claim AS (
  SELECT job_id FROM jobs
  WHERE status = 'ready' AND run_after <= now()
  ORDER BY run_after, job_id
  FOR UPDATE SKIP LOCKED LIMIT 20
)
UPDATE jobs j SET status = 'running', lease_until = now() + INTERVAL '5 minutes'
FROM claim c WHERE j.job_id = c.job_id
RETURNING j.*;`, 'sql',
    ['Holding a transaction open throughout the job causes avoidable lock retention.', 'A lease requires ownership tokens to reject stale acknowledgements.'],
    ['How would you prevent a slow worker from acknowledging after its lease expired?', 'How would you make an external payment side effect idempotent?'],
    'https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE'),
  question('postgres', 20, 'Online migrations', 'Add a required column to a hot table', 'Scenario', 12,
    'A billion-row table needs a new required business column and a supporting index while ingestion continues. Describe a staged migration, compatibility rollout, backfill, and validation.',
    [
      'Use an expand-and-contract rollout: introduce a compatible nullable column, deploy writers that populate it, backfill old rows in bounded batches, validate coverage, and only then enforce the required constraint and remove compatibility code. Exact DDL cost depends on the database version and the default or expression involved, so inspect the intended command rather than assuming every add-column operation rewrites the table. Set a short lock timeout to avoid silently queueing production traffic.',
      'Throttle backfills by observed WAL generation, replication lag, lock waits, and vacuum pressure. Use a stable batching key and a resumable checkpoint, and ensure concurrent updates do not get overwritten by an old backfill value. Build the new index concurrently when appropriate and verify it is valid after failures. Rehearse rollback as well as rollout: application compatibility usually matters more than reversing every schema step. Keep validation queries and operational stop conditions ready before starting.',
    ], '', 'sql',
    ['An unbounded backfill can create a WAL and vacuum incident.', 'A failed concurrent index build may leave an invalid index to inspect.'],
    ['How would a NOT VALID check help stage enforcement?', 'What happens if old application instances keep writing NULL?'],
    'https://www.postgresql.org/docs/current/sql-altertable.html'),
];
const python = [
  question('python', 1, 'Types and mutability', 'Explain aliasing and mutable defaults', 'Coding', 8,
    'A transform function appends to a default list and unexpectedly retains records between calls. Explain object identity, mutability, shallow copies, and a safe function signature.',
    [
      'Python names refer to objects, and assignment does not copy those objects. Default arguments are evaluated when a function is defined, so a list default is shared by subsequent calls that omit it. Use None as the sentinel and create the collection inside the function. Distinguish identity from equality: two equal lists can be different objects, while two names can point to the same mutable list.',
      'A shallow copy creates a new outer container but still shares nested mutable objects. Deep copying can isolate nested state but may be costly or inappropriate for resources such as connections. Prefer an explicit ownership contract: either mutate an input intentionally and document it, or return a new result. Immutable tuples can still contain mutable objects, so container immutability is not transitive. Test repeated calls and nested aliases, because a single successful invocation will not reveal retained state.',
    ],
    `def collect(record, records=None):
    if records is None:
        records = []
    records.append(record)
    return records`, 'python',
    ['dict.copy() does not isolate nested lists or dictionaries.', 'Using records or [] changes the behavior for an intentionally supplied empty list.'],
    ['When would a frozen dataclass still contain mutable state?', 'How would you document ownership in a transformation API?'],
    'https://docs.python.org/3/tutorial/controlflow.html#default-argument-values'),
  question('python', 2, 'Collections', 'Choose data structures from the operation mix', 'Concept', 8,
    'A pipeline needs FIFO work, frequency counts, membership checks, and the ten largest values from a stream. Choose Python collections and explain average complexity and memory tradeoffs.',
    [
      'Use deque for efficient appends and removals at opposite ends, Counter for frequency aggregation, and a set for average constant-time membership when items are hashable. A list is appropriate for indexed sequential storage but removing its first element shifts the remaining items. A bounded min-heap of size ten retains the largest ten values using logarithmic update work and constant memory relative to the full stream.',
      'Complexity estimates depend on hashing, comparison cost, and distribution; dictionary and set operations are not a promise that every input is constant-time. Python objects also carry substantial overhead, so millions of boxed numbers may justify an array, a columnar library, or external aggregation. Preserve duplicates and tie rules intentionally when using a heap. Benchmark the real operation mix, and avoid replacing a simple structure with a complex one unless profiling identifies a meaningful bottleneck.',
    ],
    `from collections import Counter, deque
from heapq import nlargest

queue = deque(["file-a", "file-b"])
counts = Counter(["ok", "ok", "retry"])
top_ten = nlargest(10, values)  # values may be an iterator`, 'python',
    ['list.pop(0) repeatedly creates quadratic total movement.', 'A set removes multiplicity and does not provide a business ordering contract.'],
    ['How would you count keys that do not fit in memory?', 'How would you retain the first item among equal priorities?'],
    'https://docs.python.org/3/library/collections.html'),
  question('python', 3, 'Iteration', 'Design a reusable iterable', 'Coding', 8,
    'A file-processing object works on the first loop but returns no records on the second. Explain iterable versus iterator, exhaustion, and how you would design a reusable input abstraction.',
    [
      'An iterable can provide an iterator through iter(), while an iterator tracks traversal state and yields values through next() until StopIteration. A generator object is an iterator and is normally single-pass. Returning the same stored iterator from every call to __iter__ means subsequent loops share or exhaust its state. A reusable iterable should create a fresh iterator for each traversal when the underlying source can be reopened safely.',
      'Reusability can be expensive or impossible for sockets and one-time streams, so state that contract rather than quietly buffering everything. Reopening a file can also observe changed data; reproducible pipelines need an immutable object version or manifest. Resource lifetime should be explicit, with a context manager or generator cleanup that closes the source. Test two sequential loops, nested iteration, partial consumption, and early exit. Avoid accepting a generic iterable and assuming len() or random indexing is available.',
    ],
    `from pathlib import Path

class Lines:
    def __init__(self, path):
        self.path = Path(path)

    def __iter__(self):
        with self.path.open(encoding="utf-8") as handle:
            yield from handle`, 'python',
    ['A generator object cannot be restarted by calling iter() again.', 'Converting an arbitrary iterable to a list can exhaust memory.'],
    ['How would you expose a one-shot stream in the API?', 'What happens when a consumer stops a generator early?'],
    'https://docs.python.org/3/library/stdtypes.html#iterator-types'),
  question('python', 4, 'Generators', 'Stream and batch a large input', 'Coding', 10,
    'Process a forty-gigabyte text file in bounded batches without loading it all into memory. Explain generator laziness, cleanup, backpressure, and where memory can still grow.',
    [
      'A generator suspends execution at yield and resumes when the consumer requests another value. Combine line-by-line reading with bounded batching so memory scales with a batch rather than the file. Keep parsing and validation streaming, and separate rejected records from valid batches with bounded buffering. Laziness propagates only until an operation such as list(), sorted(), or an unbounded grouping materializes the stream.',
      'The consumer naturally controls demand in a synchronous iterator chain, but an unbounded producer queue can defeat that backpressure. Close resources with a context manager and ensure early cancellation closes or finalizes the generator. Be careful when retrying after partial consumption: the iterator has advanced, so a durable input position or stable batch identity is needed. Test an empty file, the final short batch, malformed lines, exceptions inside the consumer, and a batch-size limit of one.',
    ],
    `from itertools import islice

def batches(items, size):
    if size <= 0:
        raise ValueError("size must be positive")
    iterator = iter(items)
    while batch := list(islice(iterator, size)):
        yield batch`, 'python',
    ['A downstream sorted() call materializes the entire upstream stream.', 'Retrying a consumed generator does not replay its previous values.'],
    ['How would you checkpoint a file iterator safely?', 'How would async queues change the backpressure design?'],
    'https://docs.python.org/3/howto/functional.html#generators'),
  question('python', 5, 'Decorators', 'Write instrumentation that preserves the API', 'Coding', 10,
    'Create a timing decorator for pipeline functions. Preserve metadata, propagate failures, and discuss separate handling for coroutine functions and generators.',
    [
      'A decorator receives a callable and returns a replacement callable, often closing over configuration and the original function. Use functools.wraps to preserve useful metadata and __wrapped__ for inspection. Measure elapsed duration with perf_counter, and emit timing in a finally block so failures are represented while the original exception still propagates. Avoid logging full arguments because pipeline payloads may contain secrets or personally identifiable information.',
      'A normal wrapper around an async function measures coroutine creation rather than awaited execution unless it is itself async and awaits the call. Similarly, timing a generator call measures iterator construction, not consumption. Choose whether the metric represents call setup, complete consumption, or each item, and document it. Keep instrumentation low overhead and use bounded metric labels rather than per-record IDs. Test successful returns, exceptions, decorated methods, metadata preservation, and coroutine cancellation.',
    ],
    `from functools import wraps
from time import perf_counter

def timed(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        started = perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            logger.info("operation_finished", extra={
                "operation": fn.__name__,
                "duration_s": perf_counter() - started,
            })
    return wrapped`, 'python',
    ['A synchronous wrapper does not measure awaited coroutine execution.', 'Returning from finally can suppress the original result or exception.'],
    ['How would you implement an async timing decorator?', 'How should retries affect latency and attempt metrics?'],
    'https://docs.python.org/3/library/functools.html#functools.wraps'),
  question('python', 6, 'Context managers', 'Make resource cleanup reliable', 'Coding', 10,
    'An ETL opens files and database transactions and occasionally leaks resources after exceptions. Explain the context-manager protocol and write a transaction wrapper with correct commit and rollback behavior.',
    [
      'A context manager centralizes setup and cleanup through __enter__ and __exit__, or a generator decorated with contextmanager. The exit path runs when the block finishes normally or by exception. Returning a true value from __exit__ suppresses an exception, which should be intentional rather than accidental. For a transaction, commit only after the work succeeds, roll back on failure, and always release or close the connection according to the pool ownership contract.',
      'Commit itself can fail, and a network failure can leave the outcome uncertain; the context manager cannot invent certainty, so an idempotent batch ledger may still be needed. Avoid swallowing the original failure when cleanup also raises, and keep exception chaining useful. ExitStack helps manage a dynamic number of resources. Verify the actual driver’s connection context behavior because some commit or roll back without closing. Test failures during setup, body execution, commit, and cleanup.',
    ],
    `from contextlib import contextmanager

@contextmanager
def transaction(connection):
    try:
        yield connection
        connection.commit()
    except BaseException:
        connection.rollback()
        raise`, 'python',
    ['A driver connection context may not close the connection.', 'A successful rollback call does not resolve a prior uncertain commit acknowledgement.'],
    ['When would ExitStack be useful?', 'How would you avoid masking an original exception with a cleanup error?'],
    'https://docs.python.org/3/library/contextlib.html'),
  question('python', 7, 'Object design', 'Design interchangeable pipeline adapters', 'Design', 10,
    'A pipeline must read from local files, an object store, or a test fixture. Design an interface without a large inheritance hierarchy, and explain dataclasses, composition, and dependency injection.',
    [
      'Model the smallest behavior the pipeline needs, such as iterating immutable records or opening a byte stream. A Protocol can express that structural interface for static checking without forcing every adapter into the same inheritance tree. Inject the adapter and clock through constructor or function parameters so tests can substitute deterministic implementations. Keep transformations pure where practical and isolate network and storage side effects at the boundaries.',
      'Dataclasses work well for typed configuration and records, while composition combines readers, validators, and sinks without coupling their lifecycles. Avoid a universal base class that mixes credentials, retries, parsing, and business rules. Make ownership and resource cleanup explicit in the interface, especially for streams and connections. Test a shared behavioral contract against each adapter as well as the pure transformation separately. A flexible architecture should reduce meaningful duplication rather than add abstractions around every single function.',
    ],
    `from dataclasses import dataclass
from typing import Iterable, Protocol

@dataclass(frozen=True)
class Record:
    event_id: str
    amount_cents: int

class Source(Protocol):
    def records(self) -> Iterable[Record]: ...

def total(source: Source) -> int:
    return sum(record.amount_cents for record in source.records())`, 'python',
    ['A frozen dataclass does not recursively freeze mutable members.', 'Overly broad interfaces make small test fixtures unnecessarily complex.'],
    ['When would an abstract base class be preferable?', 'Where would you place retries in this design?'],
    'https://docs.python.org/3/library/typing.html#typing.Protocol'),
  question('python', 8, 'Exceptions', 'Separate bad records from failed infrastructure', 'Design', 10,
    'A batch parser catches Exception and continues after every failure, producing incomplete output with a success status. Design error categories, propagation, quarantine, and useful exception context.',
    [
      'Separate expected record-level validation failures from transient infrastructure errors and programming defects. A malformed amount may be quarantined with its source position under an agreed completeness policy; a database outage should fail or retry the batch, and an unexpected AttributeError should usually surface as a defect. Catch the narrowest meaningful exception near the boundary where a recovery decision can be made. Preserve causality using raise NewError(...) from original_error.',
      'Record accepted, rejected, and expected counts so a successful job cannot silently lose data. Attach batch ID, file version, and bounded record context while redacting sensitive values. Use finally or context managers for cleanup rather than duplicating it across exception branches. Do not catch BaseException in ordinary recovery code because it includes shutdown-related exceptions. Test each category and a failure during quarantine itself; otherwise the error-handling path can become a second unobserved data-loss mechanism.',
    ],
    `class InvalidRecord(ValueError):
    pass

def parse_amount(text):
    try:
        return int(text)
    except ValueError as error:
        raise InvalidRecord("amount must be integer cents") from error`, 'python',
    ['Catching every Exception and continuing can turn corruption into apparent success.', 'Logging a full rejected row may expose sensitive data.'],
    ['When should rejected records block the whole batch?', 'How would you handle quarantine storage being unavailable?'],
    'https://docs.python.org/3/tutorial/errors.html'),
  question('python', 9, 'Concurrency and the GIL', 'Choose threads, processes, or native code', 'Scenario', 12,
    'A pipeline spends time downloading files, parsing Python dictionaries, and compressing data. Choose concurrency strategies and explain the limits of the GIL without assuming all Python runtimes behave identically.',
    [
      'Profile the stages first. Threads can overlap blocking network I/O, while CPU-bound Python bytecode on a conventional GIL-enabled CPython build usually needs processes or a different execution engine for multicore throughput. Native extensions may release the GIL during expensive operations, so compression or vectorized work can scale differently from pure Python parsing. Process pools add serialization, startup, and memory costs, making tiny tasks a poor fit.',
      'CPython also offers free-threaded builds, so inspect the actual interpreter and extension compatibility instead of claiming that Python threads can never execute in parallel. Free threading does not remove the need for synchronization around shared invariants. Bound worker counts and outstanding tasks to avoid overwhelming remote services or duplicating large in-memory inputs. Benchmark complete throughput and memory, not just one operation. Include shutdown, cancellation, worker failure, and safe handling of non-picklable resources in the design.',
    ], '', 'python',
    ['The GIL is not a substitute for locks around multi-step shared-state changes.', 'Submitting millions of futures creates an unbounded memory queue.'],
    ['How would you determine whether a native library releases the GIL?', 'What changes under a free-threaded build?'],
    'https://docs.python.org/3/howto/free-threading-python.html'),
  question('python', 10, 'Async I/O', 'Bound async requests and preserve cancellation', 'Coding', 12,
    'Fetch metadata for thousands of objects with an async client. Limit concurrency, enforce deadlines, handle partial failures, and explain why a blocking client call harms the event loop.',
    [
      'Asyncio cooperatively schedules tasks when they await operations that yield control. A synchronous blocking network call or CPU-heavy loop blocks the event loop even when placed inside async def. Use an actual async client, or carefully offload blocking I/O with to_thread when appropriate. Bound active requests with a semaphore and also bound task creation or use a worker queue for very large inputs.',
      'Use explicit timeouts and structured task lifetimes so sibling tasks and resources are cleaned up on failure. TaskGroup is useful when related tasks should fail together; partial-success workflows need an explicit result or error representation per item. Preserve CancelledError rather than converting cancellation into an ordinary retry. Apply rate limits separately from concurrency limits because fast requests can still exceed a requests-per-second quota. Test timeouts, cancellation, server throttling, and responses arriving in a different order from input.',
    ],
    `import asyncio

async def fetch_one(client, key, semaphore):
    async with semaphore:
        async with asyncio.timeout(15):
            return await client.fetch(key)

async def fetch_small_batch(client, keys):
    semaphore = asyncio.Semaphore(20)
    async with asyncio.TaskGroup() as group:
        tasks = [group.create_task(fetch_one(client, key, semaphore)) for key in keys]
    return [task.result() for task in tasks]`, 'python',
    ['A semaphore limits active work but does not bound the number of created tasks.', 'Catching cancellation as a retryable failure can prevent shutdown.'],
    ['How would you implement a bounded worker queue?', 'How do a rate limit and a concurrency limit differ?'],
    'https://docs.python.org/3/library/asyncio-task.html'),
  question('python', 11, 'Typing and contracts', 'Type a messy ingestion boundary', 'Design', 8,
    'An API returns untyped JSON with optional fields. Explain TypedDict, dataclasses, Protocol, generics, runtime validation, and where Any should stop spreading.',
    [
      'Type annotations help static tools reason about interfaces but do not validate arbitrary JSON at runtime. Treat incoming data as untrusted, validate required fields and value ranges, then convert it into a typed domain record. TypedDict describes dictionary shapes, dataclasses represent structured objects, and Protocol expresses behavior shared by different implementations. Use precise Optional or union types when absence is meaningful rather than letting Any erase useful checks.',
      'Generics preserve relationships between input and output types in reusable containers or transformations. Keep dynamic data near the ingestion boundary, and narrow it through explicit checks before business logic. Avoid casting merely to silence a checker; a cast is a promise, not a conversion. Pair static checking with runtime and integration tests because neither proves semantic correctness alone. Design error messages that identify which source contract failed without dumping credentials or full personal payloads.',
    ], '', 'python',
    ['Annotations and typing.cast do not enforce runtime validity.', 'An Any value can silently disable checking through a large call chain.'],
    ['When would you choose TypedDict over a dataclass?', 'How would you represent a validated monetary amount?'],
    'https://docs.python.org/3/library/typing.html'),
  question('python', 12, 'Testing', 'Test a pipeline at the right boundaries', 'Design', 10,
    'Design tests for a file-to-database ingestion pipeline. Include deterministic unit tests, contract checks, failure injection, and the limits of mocks.',
    [
      'Test pure parsing and transformations with small representative inputs and explicit expected outputs. Include boundary cases such as empty input, duplicate events, invalid encoding, decimal rounding, and timezone transitions. Use table-driven cases or property-based ideas for invariants such as idempotency, conservation of totals, and order independence where intended. Inject a clock, random source, and storage interfaces so the tests do not depend on wall time or network timing.',
      'Add focused integration tests against the real database behavior for transactions, constraints, and retry semantics. Mocks can verify an interaction contract but cannot prove that SQL syntax, driver adaptation, or storage permissions work. Inject failures before commit, after commit acknowledgement loss, and during checkpoint updates to test recovery. Keep fixtures minimal and assert business outcomes rather than internal call sequences. A useful suite catches realistic regressions while remaining fast enough that engineers run it routinely.',
    ], '', 'python',
    ['A fully mocked database test cannot verify transaction semantics.', 'Tests that repeat the implementation can reproduce the same bug.'],
    ['How would you test an uncertain commit outcome?', 'Which properties should hold after replaying the same batch twice?'],
    'https://docs.python.org/3/library/unittest.html'),
  question('python', 13, 'Files and serialization', 'Read hostile CSV and publish outputs atomically', 'Scenario', 10,
    'A partner CSV contains quoted newlines, Unicode, large numeric IDs, and blank fields. Explain correct parsing and how to prevent downstream readers from seeing a partially written output file.',
    [
      'Use the csv module with explicit encoding, delimiter, quoting, and newline handling instead of splitting lines on commas. Keep identifiers as strings when leading zeros or large integer precision matter. Define whether blank fields represent missing values, empty text, or invalid input, and validate dates and numbers explicitly. Stream rows and quarantine malformed records under a documented completeness policy rather than silently guessing types.',
      'Write a local output to a temporary file on the same filesystem, flush and close it, then atomically replace the final path when the platform supports that guarantee. Object stores usually need a manifest or versioned-prefix publication design rather than assuming filesystem rename semantics. Include schema version, row count, checksum, and source identity in the publication metadata. Test interrupted writes, embedded newlines, invalid UTF-8, oversized fields, and consumers reading while a new version is being published.',
    ],
    `import csv

with open("orders.csv", encoding="utf-8", newline="") as handle:
    for row in csv.DictReader(handle):
        order_id = row["order_id"]  # preserve leading zeros
        process(row)`, 'python',
    ['split(",") cannot correctly parse quoted CSV.', 'An object-store copy-and-delete is not an atomic filesystem rename.'],
    ['How would you publish several related files as one version?', 'How would you handle an unexpected byte-order mark?'],
    'https://docs.python.org/3/library/csv.html'),
  question('python', 14, 'Database access', 'Stream query results without leaking transactions', 'Design', 10,
    'A Python process runs SELECT * and fetchall() against a large table, exhausting memory and leaving an idle transaction. Redesign query execution, parameter binding, fetching, and cleanup.',
    [
      'Select only needed columns and use the driver’s supported parameter binding rather than string interpolation. For large results, use an appropriate server-side cursor or streaming API and fetch bounded batches; fetchmany alone may not avoid full client buffering in every driver. Keep cursor and connection ownership explicit and close or return them on all paths. Understand when the driver opens a transaction, including for reads.',
      'A long server-side cursor can hold a snapshot and delay database cleanup, so balance streaming duration against keyset-chunked extraction with a defined consistency contract. Set connection and statement timeouts, and avoid slow external processing while holding unnecessary transactions. Use a stable extraction boundary if chunking must produce a reproducible snapshot. Never share a connection concurrently unless the driver explicitly supports the required pattern. Test disconnects mid-fetch, consumer exceptions, empty results, and retry after a partially emitted batch.',
    ], '', 'python',
    ['Parameterized values do not parameterize SQL identifiers such as table names.', 'Client-side fetchmany does not guarantee server-side streaming.'],
    ['When would keyset chunking be preferable to a long cursor?', 'How would you validate a dynamic table identifier safely?'],
    'https://peps.python.org/pep-0249/'),
  question('python', 15, 'Retries and idempotency', 'Retry a remote write safely', 'Design', 12,
    'An HTTP write times out after the server may have applied it. Design retry classification, exponential backoff, jitter, deadlines, and an idempotency contract.',
    [
      'A timeout describes the client’s uncertainty, not proof that the remote operation failed. Retry only operations whose duplicate execution is safe or protected by a stable idempotency key recognized by the receiver. Distinguish transient network errors, throttling, and selected server failures from authentication, validation, and permanent business errors. Respect server retry guidance and classify failures using the client’s documented exception types rather than matching arbitrary strings.',
      'Use bounded exponential backoff with jitter, a maximum attempt count, and an overall deadline so retries do not amplify an outage indefinitely. Limit concurrent retries and avoid nested retry layers multiplying attempts. Preserve the same request identity and payload across retries, and reconcile uncertain outcomes through a status lookup when supported. Record attempts and final outcomes separately while redacting sensitive payloads. Test a successful remote commit followed by a lost response, because that is the case a simple retry unit test often misses.',
    ], '', 'python',
    ['A timeout does not prove that the server rejected the write.', 'Independent retry policies at several layers can multiply total requests.'],
    ['What must a server store for a useful idempotency key?', 'How would you retry a whole database transaction rather than one statement?'],
    'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/'),
  question('python', 16, 'Memory and profiling', 'Investigate a growing worker process', 'Debugging', 12,
    'A long-running Python worker gains memory after every batch. Explain how to separate retained objects, native allocations, allocator behavior, and an actually unbounded design.',
    [
      'Measure resident memory alongside Python allocation snapshots and batch-level cardinality metrics. tracemalloc can attribute many Python allocations, while native libraries and memory mappings may require process-level or library-specific tools. Look for retained references in global dictionaries, caches, queues, closures, exception tracebacks, and accumulated futures. A stable live-object count with a high resident footprint can reflect allocator behavior rather than a continuing leak.',
      'Reproduce with representative batches, compare snapshots after warm-up, and identify which object types or call sites grow with processed work. Replace unbounded collections with bounded caches, streaming aggregation, or external state; calling garbage collection does not fix reachable objects. Account for temporary copies during serialization, joins, and conversion between libraries. Verify both peak memory and steady-state memory after a correction. Keep a minimal regression workload, but avoid treating a single RSS measurement as proof of a leak or a fix.',
    ], '', 'python',
    ['Garbage collection cannot reclaim objects still referenced by an unbounded cache.', 'tracemalloc does not represent every native allocation.'],
    ['How can saved exception objects retain large payloads?', 'What is the difference between peak and steady-state memory?'],
    'https://docs.python.org/3/library/tracemalloc.html'),
  question('python', 17, 'Logging and observability', 'Make pipeline logs operationally useful', 'Design', 8,
    'A pipeline emits thousands of print statements but an on-call engineer cannot identify which batch failed or whether a retry succeeded. Design logs, metrics, and correlation context.',
    [
      'Use the logging package with consistent event names and structured fields such as run ID, batch ID, source partition, operation, attempt, duration, and row counts. Emit one useful boundary event instead of a verbose message for every successful row. Log exceptions with stack traces at the layer that owns recovery, avoiding repeated logging at every call frame. Keep credentials, tokens, and personal payloads out of messages and exception context.',
      'Metrics should summarize throughput, freshness, failure rate, retries, queue depth, and rejected records with bounded label cardinality. A batch ID belongs in logs or traces, not in a metric label that creates millions of series. Propagate correlation context through threads and async tasks intentionally, for example with contextvars where suitable. Define alerts around user-visible freshness and correctness objectives rather than log volume. Test that a failed attempt followed by success remains distinguishable from an entirely failed run.',
    ], '', 'python',
    ['Per-record IDs in metric labels create excessive cardinality.', 'Logging the same exception at every layer creates noise without new evidence.'],
    ['How would you propagate context into a thread pool?', 'Which freshness metric would you page on?'],
    'https://docs.python.org/3/howto/logging-cookbook.html'),
  question('python', 18, 'Packaging and configuration', 'Make the same pipeline reproducible everywhere', 'Design', 8,
    'A notebook works locally but fails in a scheduled job because of imports, dependency versions, and environment variables. Explain packaging, configuration validation, and reproducible execution.',
    [
      'Package business logic as importable modules with a clear entry point rather than relying on notebook execution order or ad hoc sys.path changes. Declare supported Python and dependency versions in project metadata and use a reproducible dependency resolution process appropriate to the environment. Separate immutable code artifacts from runtime configuration and secrets. Validate required settings and incompatible options at startup so a deployment fails clearly before processing data.',
      'Pass configuration as a typed object to core logic instead of reading environment variables throughout the code. Resolve paths relative to explicit inputs or package resources, not an assumed working directory. Use managed secret injection and avoid embedding credentials in artifacts or debug output. Test the built package in a clean environment using the same entry point as production. Record artifact version, configuration fingerprint, and source manifest with each run to make results and incident investigations reproducible.',
    ], '', 'python',
    ['Notebook state can conceal missing imports and execution-order dependencies.', 'An unpinned local dependency set is not a reproducible production artifact.'],
    ['Which configuration belongs in version control?', 'How would you test the installed package rather than the source checkout?'],
    'https://packaging.python.org/en/latest/tutorials/packaging-projects/'),
  question('python', 19, 'Numerical and temporal correctness', 'Handle money and timestamps without silent drift', 'Coding', 10,
    'A Python reconciliation differs from finance by a few cents and occasionally assigns transactions to the wrong date. Explain Decimal, integer minor units, timezone-aware datetime, and boundary validation.',
    [
      'Binary floating-point cannot exactly represent many decimal fractions, so use integer minor units or Decimal with an explicit currency, scale, and rounding rule for financial values. Construct Decimal from decimal strings rather than an already rounded float. Decide when rounding occurs, because rounding each line and rounding the final total can produce different valid results. Preserve the finance contract instead of treating one arbitrary rounding mode as universally correct.',
      'Represent event instants with aware datetimes and use named timezones for local reporting. A naive datetime does not specify whether it is UTC or local time, and attaching a timezone is not the same as converting an already known instant. Parse and validate source offsets at the boundary, then normalize consistently. Test negative refunds, half-cent values, mixed currencies, daylight-saving ambiguity, and midnight. Serialization must retain enough scale and timezone information to reproduce the calculation downstream.',
    ],
    `from decimal import Decimal, ROUND_HALF_EVEN
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

amount = Decimal("19.995").quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
instant = datetime(2026, 11, 1, 5, 30, tzinfo=timezone.utc)
local = instant.astimezone(ZoneInfo("America/New_York"))`, 'python',
    ['Decimal(0.1) preserves the binary float approximation.', 'Replacing tzinfo is not a conversion between known instants.'],
    ['How would you represent currencies with different minor-unit scales?', 'How do you resolve an ambiguous local timestamp?'],
    'https://docs.python.org/3/library/decimal.html'),
  question('python', 20, 'Algorithms and streaming state', 'Deduplicate an unbounded event stream', 'Design', 12,
    'A Python service deduplicates event IDs using a set that grows forever. Design bounded state and explain exactness, event-time lateness, Bloom filters, and durable recovery.',
    [
      'Exact deduplication over an unbounded history requires retaining enough durable information about every relevant identity, so a finite in-memory set cannot provide that guarantee indefinitely. Define a deduplication horizon based on the source replay and lateness contract, then expire state using a deliberate event-time or processing-time policy. For stronger durability, use a store with a unique key or an idempotent sink and persist the source checkpoint only after the output is safely committed.',
      'A Bloom filter is compact but can return false positives, so using it alone may discard legitimate new events. It can be a prefilter before an exact lookup when that tradeoff makes sense. Partition state by stable event identity to spread load, and test clock skew and out-of-order events before selecting expiry rules. Monitor state size, duplicate rate, and late-beyond-horizon records. Recovery must restore both the dedup state and a compatible source position, or rely on downstream idempotency during replay.',
    ], '', 'python',
    ['A bounded cache cannot guarantee exact deduplication for unlimited history.', 'Bloom-filter false positives can become silent data loss.'],
    ['How would you atomically coordinate output and source progress?', 'When is probabilistic deduplication acceptable?'],
    'https://docs.python.org/3/library/sqlite3.html'),
];
const pyspark = [
  question('pyspark', 1, 'Execution model', 'Choose DataFrames over low-level RDDs deliberately', 'Concept', 8,
    'A senior engineer proposes converting every DataFrame to an RDD for more control. Compare the abstractions, optimization opportunities, serialization, and legitimate RDD use cases.',
    [
      'DataFrames represent structured data and expressions that Spark can analyze and optimize, including column pruning, filter pushdown, join planning, and code generation where supported. PySpark RDD operations generally expose arbitrary Python functions whose semantics are opaque to the SQL optimizer and involve Python-worker serialization. DataFrames are therefore the default for structured engineering workloads, not merely a more convenient syntax over identical execution.',
      'RDDs can still fit irregular low-level algorithms or integrations that cannot be expressed with structured APIs, but measure the cost of leaving the optimized plan. Prefer built-in expressions and distributed aggregations before falling back to Python loops. A PySpark DataFrame has a schema but is not the same as a statically typed Scala Dataset. Compare complete plans and representative throughput, and avoid collect() as a bridge to local code when the data does not fit the driver.',
    ], '', 'python',
    ['Converting to an RDD discards many SQL optimization opportunities.', 'A DataFrame schema does not make arbitrary Python functions optimizer-visible.'],
    ['When would mapPartitions be justified?', 'How would you replace a Python loop with built-in expressions?'],
    'https://spark.apache.org/docs/latest/sql-programming-guide.html'),
  question('pyspark', 2, 'Catalyst and plans', 'Trace a DataFrame from expressions to tasks', 'Concept', 10,
    'Explain parsed, analyzed, optimized, and physical plans. Show how you would verify column pruning, filter pushdown, exchange boundaries, and the selected join strategy.',
    [
      'Spark first represents a query as a logical expression tree, resolves columns and types during analysis, and applies logical optimizations before selecting a physical plan. The physical plan maps operations to concrete scans, joins, exchanges, and execution operators. DataFrame transformations build this plan rather than immediately processing every row. explain with extended or formatted output helps distinguish an intended transformation from the actual chosen execution strategy.',
      'Look at required scan columns, pushed filters, partition filters, and Exchange nodes that indicate data movement. A predicate above a Python UDF may not be pushed through it, while a built-in expression can remain visible to optimization. Statistics and runtime adaptive decisions affect join selection, so inspect the completed query plan in the UI as well as the initial explanation. Validate results when rewriting expressions; faster execution is irrelevant if null semantics, duplicate handling, or timezone interpretation changed.',
    ],
    `query = (spark.read.parquet(input_path)
    .filter("event_date >= '2026-11-01'")
    .select("customer_id", "amount")
    .groupBy("customer_id").sum("amount"))
query.explain(mode="formatted")`, 'python',
    ['The initial physical plan can differ from the final adaptive plan.', 'A filter appearing in code does not prove storage-level pushdown occurred.'],
    ['What does an Exchange node tell you?', 'How can missing statistics influence join selection?'],
    'https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.explain.html'),
  question('pyspark', 3, 'Lazy evaluation', 'Explain repeated actions and lineage', 'Scenario', 8,
    'A job calls count(), show(), and write() on the same expensive DataFrame and appears to run the transformation three times. Explain laziness, actions, lineage, and when persistence or checkpointing helps.',
    [
      'Transformations describe work lazily, while actions request results or output and trigger execution. Without reusable persisted results, separate actions may recompute the same lineage. A preview or validation count is therefore real work, not free metadata inspection. Spark can recover lost partitions by recomputing deterministic lineage, which is a major part of its fault-tolerance model. Driver-side code that constructs the plan and executor-side work have different lifecycles.',
      'Persist a reused, expensive intermediate only when its recomputation cost and reuse justify memory or disk consumption, and materialize it deliberately. Unpersist after the final consumer. Checkpointing truncates lineage by writing a durable intermediate and is useful for very long or iterative plans; it is not simply another spelling of cache. Avoid nondeterministic side effects inside transformations because retries and repeated actions can run them again. Measure whether the extra validation action can be replaced by metrics collected during the write.',
    ], '', 'python',
    ['Calling cache() does not immediately execute or materialize a DataFrame.', 'Executor retries make transformation side effects unsafe.'],
    ['How do cache and checkpoint differ after executor loss?', 'How would you reduce repeated scans while retaining quality checks?'],
    'https://spark.apache.org/docs/latest/rdd-programming-guide.html#rdd-operations'),
  question('pyspark', 4, 'Shuffles', 'Identify and reduce expensive data movement', 'Debugging', 10,
    'An aggregation job spends most of its time fetching shuffle data and spilling. Explain narrow versus wide dependencies and evaluate early filtering, pre-aggregation, repartitioning, and shuffle partition sizing.',
    [
      'Narrow dependencies allow an output partition to use a limited set of parent partitions, while wide dependencies redistribute records across the cluster and create shuffle boundaries. Grouping, distinct, many joins, and repartition commonly require shuffles. Shuffle writes, network transfer, sorting, and disk spills can dominate even when the Python code is short. Inspect stage metrics and record counts to determine which exchange is expensive before changing cluster size.',
      'Filter rows and select columns early, aggregate before joins when the business grain allows it, and use map-side-combinable built-in aggregates. Choose enough partitions to avoid oversized tasks without creating excessive scheduling and small-file overhead. Blind repartitioning can add another full shuffle and may not help the next operation. Examine key skew separately from average partition size. Test with representative data and verify whether adaptive execution already coalesces or splits relevant partitions before adding manual controls.',
    ], '', 'python',
    ['repartition() is itself a shuffle and can duplicate work.', 'Average partition size conceals one extremely large hot-key partition.'],
    ['Why is groupByKey often worse than a combinable aggregation?', 'How would you separate network saturation from skew?'],
    'https://spark.apache.org/docs/latest/rdd-programming-guide.html#shuffle-operations'),
  question('pyspark', 5, 'Skew', 'Handle one key that dominates a join', 'Debugging', 12,
    'A join has thousands of tasks that finish quickly and one task that runs for forty minutes. One customer owns thirty percent of the records. Compare AQE, salting, broadcast, and separate hot-key handling.',
    [
      'Confirm skew from task-duration, shuffle-read, and key-frequency evidence rather than treating every straggler as skew. Adaptive execution can split certain skewed join partitions when enabled and supported, but it cannot erase the intrinsic output size of a many-to-many join. Broadcasting a genuinely small dimension may avoid a large-side shuffle. If the join fanout is accidental, correcting the model is more valuable than distributing the incorrect result faster.',
      'For manual salting, distribute hot-key rows across deterministic salt buckets and replicate the matching small-side rows across those buckets, then remove the salt from the result. Aggregations may require a second combine step, and averages need sum and count rather than averages of partial averages. Isolating exceptional keys can be simpler than salting every key. Measure replication cost and validate exact row counts, null-key behavior, and deterministic replay before adopting the optimization.',
    ], '', 'python',
    ['Salting both sides independently can lose matches.', 'Skew tuning cannot make a truly enormous many-to-many output disappear.'],
    ['How would you salt a SUM aggregation safely?', 'Which metrics distinguish a hot key from an unhealthy executor?'],
    'https://spark.apache.org/docs/latest/sql-performance-tuning.html#optimizing-skew-join'),
  question('pyspark', 6, 'Adaptive query execution', 'Explain what AQE can and cannot repair', 'Concept', 10,
    'An interviewer says enabling AQE eliminates all need for Spark tuning. Explain runtime statistics, partition coalescing, join changes, skew handling, and remaining responsibilities.',
    [
      'Adaptive query execution revises parts of a physical plan using runtime statistics gathered around shuffle boundaries. Depending on configuration and the query, it can coalesce small post-shuffle partitions, switch eligible join strategies, and handle certain skewed partitions. This helps when static size estimates are inaccurate and avoids some manual tuning. Inspect the final adaptive plan and task metrics to confirm which changes actually occurred.',
      'AQE does not define a correct grain, remove arbitrary Python UDF costs, repair a poor source layout, or guarantee that an oversized broadcast fits executor memory. It also cannot avoid work already completed before a runtime decision becomes possible. Engineers still need accurate contracts, sensible file sizes, bounded state, appropriate partitioning, and representative monitoring. Tune only after observing the plan, and test changes across small and large data periods because a configuration that helps one distribution may harm another.',
    ], '', 'python',
    ['An enabled setting is not evidence that a specific query benefited.', 'Runtime optimization cannot undo all costs already paid before a shuffle completes.'],
    ['Why can a runtime broadcast conversion still leave some shuffle cost?', 'What would you compare between initial and final plans?'],
    'https://spark.apache.org/docs/latest/sql-performance-tuning.html#adaptive-query-execution'),
  question('pyspark', 7, 'Caching', 'Cache only the useful shared intermediate', 'Design', 10,
    'Three downstream calculations reuse a large filtered dataset, but caching the raw input makes the job slower. Explain placement, storage level, materialization, eviction, and lifecycle.',
    [
      'Cache the smallest expensive intermediate that is genuinely shared, usually after selective filters and column projection, rather than retaining a huge raw dataset for convenience. Persistence consumes executor storage memory and may compete with execution memory or spill to disk according to the storage level. Calling persist declares intent; the first action materializes partitions. Repeated consumers benefit only if the cached data remains available and recomputation would otherwise be costly.',
      'Inspect cache size, hit behavior, eviction, and stage timings. A one-use DataFrame often gets slower because caching adds serialization and storage work without reuse. Unpersist once consumers finish so later stages regain capacity. Use a durable materialized dataset when reuse spans jobs or requires a reproducible boundary; executor cache is not a long-term storage contract. Compare total runtime and cost under realistic concurrent workloads, and ensure cached nondeterministic transformations do not conceal an unclear business reproducibility requirement.',
    ],
    `from pyspark import StorageLevel

shared = (raw.filter("event_date >= '2026-11-01'")
    .select("customer_id", "amount")
    .persist(StorageLevel.MEMORY_AND_DISK))
try:
    write_customer_totals(shared)
    write_global_totals(shared)
finally:
    shared.unpersist()`, 'python',
    ['Caching an input used only once usually adds work without benefit.', 'Cache eviction can cause recomputation and invalidate optimistic timing assumptions.'],
    ['When would writing an intermediate table be preferable?', 'How would concurrent jobs change your cache decision?'],
    'https://spark.apache.org/docs/latest/sql-performance-tuning.html#caching-data'),
  question('pyspark', 8, 'Partitioning and files', 'Distinguish partitions, partition columns, and files', 'Design', 10,
    'Explain Spark execution partitions versus storage partition directories. Choose between repartition and coalesce, and design a write that avoids both tiny files and one huge output task.',
    [
      'Execution partitions are units of distributed work, while storage partition columns organize data into directory or table-layout groups for pruning. They are related during writes but are not the same concept. repartition redistributes data through a shuffle and can increase or decrease parallelism; coalesce usually reduces partitions with less movement but may create imbalance and limit downstream parallelism. coalesce(1) is a common scalability bottleneck.',
      'Choose output parallelism from data volume, compression, target file size, and downstream scan behavior. Do not partition storage by a high-cardinality identifier that creates millions of tiny directories. A date-based layout can help selective queries, but a small dataset may need no static partition columns. Adaptive execution and writer behavior can affect the final file count, so validate actual files and task metrics. Balance read pruning against write amplification, listing overhead, and the cost of later compaction.',
    ], '', 'python',
    ['One Spark partition does not always mean one file across all partitionBy values.', 'coalesce(1) can serialize the final stage through one executor task.'],
    ['How would you estimate a useful output file count?', 'What makes high-cardinality storage partitioning expensive?'],
    'https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.repartition.html'),
  question('pyspark', 9, 'Join strategies', 'Broadcast with a memory budget', 'Design', 10,
    'A fact table joins a dimension advertised as fifty megabytes, but forced broadcast causes executor failures. Explain join strategy selection and why source file size is an unsafe broadcast estimate.',
    [
      'A broadcast join sends the build side to participating executors so the large side can be processed without a matching shuffle. The in-memory hashed representation can be much larger than compressed source files, and each executor must have sufficient memory alongside other work. Filter and project the dimension first, verify key uniqueness, and inspect statistics and the chosen plan. A hint influences planning but does not make an oversized dataset safe.',
      'When the dimension is too large, compare a shuffle-based join with appropriate partitioning, skew handling, and executor sizing. A large join output can still overwhelm memory or storage even when broadcasting itself succeeds. Avoid collecting the dimension into a Python dictionary on the driver as a substitute for a distributed join. Benchmark with the largest realistic dimension version and concurrency level, and monitor broadcast time, executor memory, spills, and timeout behavior rather than relying on a static file-size threshold.',
    ],
    `from pyspark.sql import functions as F

small = dimension.filter("is_current = true").select("customer_id", "segment")
result = facts.join(F.broadcast(small), "customer_id", "left")`, 'python',
    ['Compressed disk size understates the in-memory hash-table footprint.', 'Broadcasting does not prevent fanout from duplicate dimension keys.'],
    ['How would you verify dimension uniqueness?', 'When might a sort-merge join be the better production choice?'],
    'https://spark.apache.org/docs/latest/sql-performance-tuning.html#optimizing-the-join-strategy'),
  question('pyspark', 10, 'UDFs and Arrow', 'Replace an expensive Python UDF', 'Scenario', 10,
    'A Python UDF normalizes strings and extracts JSON fields for every row. Compare built-in expressions, scalar Python UDFs, pandas UDFs, and Arrow transfer, including version-dependent behavior.',
    [
      'Use built-in expressions for normalization and JSON extraction when they express the required semantics, because Spark can analyze and optimize them within the structured plan. Python UDFs introduce a Python execution boundary and may limit optimization even when their serialization is efficient. Arrow can reduce JVM-to-Python transfer overhead, but default behavior and supported types vary by Spark version, so inspect the deployed runtime rather than repeating an old blanket performance claim.',
      'Pandas UDFs operate on batches and can vectorize suitable calculations, but they still need memory for those batches and are not automatically faster than native Spark expressions. Grouped pandas operations can materialize an entire group, making skew a memory risk. Define null, Unicode, timestamp, and return-type behavior and test equivalence before replacing code. Never perform per-row network calls inside a UDF: retries, speculative execution, and latency create both correctness and throughput problems.',
    ],
    `from pyspark.sql import functions as F

clean = raw.select(
    F.lower(F.trim("email")).alias("email_normalized"),
    F.get_json_object("payload", "$.customer_id").alias("customer_id"),
)`, 'python',
    ['Arrow improves transfer but does not make arbitrary Python logic optimizer-visible.', 'Grouped pandas operations can exceed memory on a single hot group.'],
    ['When would a pandas UDF be a justified choice?', 'How would you test Unicode normalization compatibility?'],
    'https://spark.apache.org/docs/latest/api/python/tutorial/sql/arrow_pandas.html'),
  question('pyspark', 11, 'Windows', 'Deduplicate with a deterministic window', 'Coding', 10,
    'Keep the latest event per account and calculate a running balance. Explain why dropDuplicates does not express latest-record precedence, and discuss window shuffles and frames.',
    [
      'dropDuplicates identifies duplicate keys but does not express which payload should survive when values differ. Use row_number over an account partition ordered by source version, event time, and a stable tie breaker, then retain rank one. For a running balance, order every event deterministically and set an explicit row frame. A default range-like frame can aggregate timestamp peers together, which differs from a row-by-row sequence.',
      'Window processing generally requires partitioning and sorting by the window keys, so large or skewed accounts can become expensive. Filter and project early, reuse compatible window definitions where the planner can, and inspect exchange and sort stages. A global window without partitionBy can concentrate work severely. Keep tombstones until after latest-event selection, and define whether late events restate balances. Test equal timestamps, duplicate deliveries, missing ordering values, and accounts large enough to expose skew.',
    ],
    `from pyspark.sql import Window, functions as F

latest = Window.partitionBy("account_id").orderBy(
    F.col("source_version").desc(), F.col("event_id").desc()
)
current = events.withColumn("rn", F.row_number().over(latest)).filter("rn = 1")
running = Window.partitionBy("account_id").orderBy("event_at", "event_id").rowsBetween(
    Window.unboundedPreceding, Window.currentRow
)
balances = events.withColumn("balance", F.sum("amount").over(running))`, 'python',
    ['dropDuplicates does not guarantee the newest payload wins.', 'A window without a partition key can create a severe bottleneck.'],
    ['How would you handle a single extremely large account?', 'What happens when you filter deletes before ranking?'],
    'https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.Window.html'),
  question('pyspark', 12, 'Storage formats', 'Choose columnar storage and verify pruning', 'Design', 8,
    'An analytics lake uses gzipped JSON files and full scans. Compare JSON, Parquet, Avro, and a transactional table format, including projection, schema, and small-file effects.',
    [
      'JSON is flexible and easy to exchange but often expensive to parse and weakly typed. Parquet is columnar, supports efficient projection and statistics-based skipping, and fits analytical scans. Avro is row-oriented and useful for schema-based interchange and record streams. Compression codec and file splittability influence parallelism, so a few huge compressed text files can be a bottleneck before any transformation begins.',
      'A table format such as Delta adds transactional metadata and lifecycle capabilities on top of data files; it is not merely another compression codec. Define schemas explicitly, normalize incompatible field meanings, and verify partition pruning and pushed filters in plans. Avoid both tiny files that create scheduling and listing overhead and enormous files that limit parallel work. Choose a format from read and write patterns, evolution requirements, and interoperability, then benchmark realistic scans rather than comparing file sizes alone.',
    ], '', 'python',
    ['A smaller compressed file is not necessarily faster for selective analytics.', 'A transactional table should not be modified by bypassing its metadata protocol.'],
    ['How would predicate pushdown differ for JSON and Parquet?', 'Why can millions of small Parquet files still perform poorly?'],
    'https://spark.apache.org/docs/latest/sql-data-sources-parquet.html'),
  question('pyspark', 13, 'Structured Streaming', 'Explain a micro-batch pipeline end to end', 'Design', 12,
    'Design a Kafka-to-analytics Structured Streaming pipeline. Explain source offsets, micro-batches, output modes, trigger choices, stateful operators, and the limits of exactly-once claims.',
    [
      'Structured Streaming applies a query over an unbounded input and tracks progress across incremental executions. In micro-batch execution, source offsets define each batch, transformations produce results, and checkpoint metadata supports recovery. Choose append, update, or complete output behavior according to the query and sink capabilities. Stateful aggregates, deduplication, and stream joins need explicit state and lateness policies; a trigger interval alone does not bound their memory.',
      'End-to-end exactly-once behavior depends on a replayable source, durable compatible checkpoints, deterministic processing where required, and a sink with appropriate transactional or idempotent semantics. A foreachBatch callback that blindly appends to an external database can duplicate results after replay. Use stable batch or event identities and monitor input rate, processing rate, backlog, state size, and event-time lag. Rehearse recovery and checkpoint restoration rather than treating a continuously running notebook as proof of reliability.',
    ], '', 'python',
    ['A short trigger interval does not guarantee low latency under backlog.', 'Exactly-once engine recovery does not automatically cover arbitrary external side effects.'],
    ['When would availableNow fit better than a permanently running stream?', 'How would you make foreachBatch idempotent?'],
    'https://spark.apache.org/docs/latest/streaming/index.html'),
  question('pyspark', 14, 'Watermarks and state', 'Explain lateness without promising a hard cutoff', 'Scenario', 12,
    'A windowed streaming aggregate uses a ten-minute watermark. Explain watermark progression, state eviction, output timing, late records, and why it is not simply ten minutes after wall-clock arrival.',
    [
      'A watermark is derived from observed event-time progress and an allowed delay, not directly from the current wall clock. It lets eligible stateful operations discard old state and, for some output modes, finalize windows. Data within the documented delay guarantee should not be dropped for being too late, while data beyond that delay may or may not still be processed depending on state and execution progress. Do not describe it as a universal exact rejection boundary.',
      'Choose lateness from measured producer delays and business correction requirements, balancing completeness against state size and result latency. Future-dated bad timestamps can distort progress, while idle sources can delay it; validate event time at ingestion. Stream-stream joins also need suitable time constraints to bound state. Monitor watermark movement, dropped-late rows, state rows, and checkpoint growth. Keep a batch reconciliation or backfill path for records outside the operational streaming horizon instead of silently declaring them impossible.',
    ],
    `from pyspark.sql import functions as F

totals = (events.withWatermark("event_at", "10 minutes")
    .groupBy(F.window("event_at", "5 minutes"), "account_id")
    .agg(F.sum("amount").alias("amount")))`, 'python',
    ['Watermark delay is based on event-time progress rather than elapsed wall time.', 'A future-dated bad event can move the event-time horizon unexpectedly.'],
    ['How would you choose a delay from observed data?', 'Why does a stream-stream join need a time-range condition?'],
    'https://spark.apache.org/docs/latest/streaming/apis-on-dataframes-and-datasets.html#handling-late-data-and-watermarking'),
  question('pyspark', 15, 'Checkpoint recovery', 'Change a streaming query safely', 'Scenario', 12,
    'A team changes grouping keys and restarts a stream from its old checkpoint. It fails or produces surprising results. Explain checkpoint contents, compatible changes, migration, and checkpoint protection.',
    [
      'A streaming checkpoint records source progress, committed batches, and state associated with the query’s operators. It is part of the application’s durable state, not disposable cache. Changes to state schema, grouping keys, sources, or certain execution settings may be incompatible with an existing checkpoint. Check the deployed Spark and source documentation for recovery compatibility rather than assuming any edited query can resume from the same directory.',
      'For incompatible changes, design a new checkpoint and an explicit replay or bootstrap strategy, often writing to a new target until validation and cutover. Preserve source retention long enough to rebuild, and make destination writes idempotent so controlled reprocessing is safe. Give each independent query its own durable checkpoint path and protect it from lifecycle deletion or concurrent writers. Test failure recovery, deployment rollback, and state restoration in a representative environment before replacing the production query.',
    ], '', 'python',
    ['Deleting a checkpoint can cause full replay, duplication, or data loss depending on source settings.', 'Two independent queries must not share one checkpoint directory.'],
    ['How would you migrate to a new aggregation key?', 'What source retention is needed to rebuild state?'],
    'https://spark.apache.org/docs/latest/streaming/apis-on-dataframes-and-datasets.html#recovery-semantics-after-changes-in-a-streaming-query'),
  question('pyspark', 16, 'Memory and failure', 'Diagnose driver and executor OOM separately', 'Debugging', 12,
    'A Spark application fails with out-of-memory errors. Explain how you distinguish driver pressure, executor JVM heap, Python worker memory, skew, broadcast size, and container overhead.',
    [
      'Find which process failed and inspect its logs before increasing memory. Driver failures often follow collect(), toPandas(), enormous plans, or too many task results. Executor failures may come from oversized partitions, skewed groups, large hash joins, cache competition, or serialization buffers. Python workers and native libraries consume memory beyond the executor JVM heap, so container limits and memory overhead settings matter as well.',
      'Use task metrics, spill volumes, garbage-collection time, partition sizes, and the physical plan to identify the dominant allocation. Reduce rows and columns, fix skew, use safer joins, and avoid unbounded grouped pandas operations before adding resources. More executor cores can increase concurrent memory demand within the same process. Tune partition size and concurrency together, then verify peak memory and throughput under realistic load. A bigger cluster may postpone an unbounded-state failure without solving its cause.',
    ], '', 'python',
    ['Increasing executor heap does not necessarily cover Python or native-process memory.', 'collect() can crash the driver even when executors have ample memory.'],
    ['Why can more cores per executor worsen memory pressure?', 'How would you identify one skewed partition from the UI?'],
    'https://spark.apache.org/docs/latest/tuning.html'),
  question('pyspark', 17, 'Monitoring', 'Turn a slow stage into a concrete hypothesis', 'Debugging', 10,
    'A nightly Spark job regressed from twenty to ninety minutes. Describe how the Spark UI, event logs, SQL plans, and task distributions guide an investigation.',
    [
      'Compare the current run with a known-good run using the same business volume and configuration where possible. Identify whether time increased in planning, file listing, scheduling, scanning, shuffle, computation, or output commit. Stage and task distributions reveal whether all tasks slowed down or a few stragglers dominate. Examine input size, shuffle read and write, spills, garbage collection, retries, executor loss, and scheduler delay instead of relying on total duration alone.',
      'Use the SQL plan to connect a slow stage to a concrete operator and inspect the final adaptive plan. Event logs and a history server preserve evidence after a cluster terminates. Form one hypothesis, such as a dimension growth disabling broadcast or a new hot key, then test a targeted change. Track cost and correctness with latency. Keep code version, runtime version, source snapshot, and configuration attached to each run so future comparisons are meaningful.',
    ], '', 'python',
    ['A single average task duration hides skew and repeated failures.', 'Losing cluster-local logs after termination removes critical regression evidence.'],
    ['Which metrics distinguish scheduling overhead from heavy computation?', 'How would you compare two final adaptive plans?'],
    'https://spark.apache.org/docs/latest/monitoring.html'),
  question('pyspark', 18, 'Testing', 'Test distributed transformations without relying on row order', 'Design', 10,
    'Design tests for a PySpark transformation with deduplication, joins, decimals, and timestamps. Explain explicit schemas, order independence, built-in assertion utilities, and local-test limitations.',
    [
      'Keep transformations as functions from DataFrames to DataFrames and separate I/O and SparkSession creation. Build tiny fixtures with explicit schemas so empty inputs, nullable fields, decimals, and timestamps have deliberate types. Assert both schema and business results, using PySpark testing utilities supported by the deployed version. Distributed DataFrames do not have an inherent row order, so sort by a complete key only when the test needs deterministic comparison.',
      'Include duplicate keys, null join keys, equal ranking timestamps, late events, and values that reveal rounding or timezone differences. Check invariants such as total preservation and idempotent replay rather than only one happy-path output. Local tests cannot prove production performance, skew resilience, object-store commit behavior, or cluster permissions; use focused integration tests for those boundaries. Pin relevant Spark configuration in tests and avoid collect() on production-sized fixtures merely because collection is convenient for small unit cases.',
    ],
    `from pyspark.testing.utils import assertDataFrameEqual, assertSchemaEqual

actual = transform(input_df)
assertSchemaEqual(actual.schema, expected.schema)
assertDataFrameEqual(actual.orderBy("event_id"), expected.orderBy("event_id"))`, 'python',
    ['Spark output row order is undefined without an explicit orderBy.', 'Inferring schemas from tiny fixtures can hide production type problems.'],
    ['How would you test deterministic tie breaking?', 'Which behavior needs an object-store integration test?'],
    'https://spark.apache.org/docs/latest/api/python/getting_started/testing_pyspark.html'),
  question('pyspark', 19, 'Schemas and NULL', 'Prevent silent schema drift and null joins', 'Scenario', 10,
    'A CSV field changes from integer to free text and a join suddenly loses records with missing keys. Explain explicit schemas, malformed input, null-safe equality, and safe schema evolution.',
    [
      'Inferencing a schema from sampled files can vary between runs and silently change downstream behavior. Define the ingestion schema and validate casts, routing malformed values to a controlled rescue or quarantine path. Preserve raw values and source positions when diagnosis or reprocessing matters. Distinguish absent fields, empty strings, SQL NULL, and invalid numeric text instead of coercing them all to one convenient default.',
      'Ordinary equality does not match NULL keys; null-safe equality can, but matching every unknown key to every other unknown key may create a huge and semantically wrong fanout. Decide whether missing identity should be quarantined, assigned an explicit unknown dimension member, or retained as unmatched. Track schema versions and require review for incompatible changes. Test empty datasets, all-null columns, malformed dates, precision overflow, and joins with null keys under the actual runtime’s ANSI and timezone settings.',
    ],
    `# Use null-safe equality only when matching unknown keys is intended.
joined = left.join(right, left["key"].eqNullSafe(right["key"]), "left")`, 'python',
    ['Matching NULL keys can multiply unrelated unknown records.', 'Schema inference can change when a different sample of files is read.'],
    ['How would ANSI mode change cast-failure behavior?', 'What information belongs in a quarantine record?'],
    'https://spark.apache.org/docs/latest/sql-ref-null-semantics.html'),
  question('pyspark', 20, 'Writes and side effects', 'Make foreachBatch output idempotent', 'Design', 12,
    'A streaming foreachBatch callback writes to a JDBC table and sometimes duplicates records after a restart. Design an idempotent sink and explain batch IDs, transactions, and multiple outputs.',
    [
      'foreachBatch exposes each micro-batch as a batch DataFrame, but the callback can run again after a failure. Use stable event keys or a batch identity scoped to the query to deduplicate writes. In a relational sink, stage rows and atomically merge them with a batch-ledger record using constraints and a transaction. Do not assume Spark task retries make arbitrary per-row external side effects exactly once.',
      'If the callback writes several sinks, there is usually no shared transaction across them. Make each output independently idempotent and track publication status, or publish through an outbox or manifest that supports reconciliation. Persist a batch only when multiple actions would otherwise recompute expensive work, then release it. A new checkpoint may restart batch numbering, so batch ID alone is not a globally unique identity. Test a crash after one output commits and before Spark records the batch as complete.',
    ], '', 'python',
    ['A new checkpoint can reuse numeric batch IDs from an earlier query instance.', 'Two sink writes are not automatically atomic together.'],
    ['How would you scope a batch-ledger key?', 'How would you recover when one of two outputs committed?'],
    'https://spark.apache.org/docs/latest/streaming/apis-on-dataframes-and-datasets.html#using-foreach-and-foreachbatch'),
];
const databricks = [
  question('databricks', 1, 'Delta foundations', 'Explain what makes Delta transactional', 'Concept', 10,
    'Explain how Delta Lake provides consistent reads and atomic table updates over object storage. Contrast its transaction log with a directory of Parquet files and discuss protocol compatibility.',
    [
      'A Delta table combines data files with a transaction log that defines the table snapshot and records committed changes. Readers use a consistent snapshot rather than treating every object in a directory as current data. Writers produce new data and commit metadata under the table protocol, enabling atomic visibility and concurrency checks. Parquet provides a columnar file representation; it does not by itself coordinate a table transaction or define which files belong to a version.',
      'Do not edit or delete underlying files outside supported table operations, because that bypasses the snapshot contract. Features such as deletion vectors or column mapping can change reader and writer protocol requirements, so validate every downstream client before enabling them. A durable log is not a substitute for retention and recovery planning, and single-table atomicity should not be assumed to cover arbitrary external side effects. Inspect table history and metadata when investigating an unexpected result or a failed write.',
    ], '', 'sql',
    ['Directly deleting Parquet files can corrupt a valid table snapshot.', 'Enabling a table feature may exclude older readers or writers.'],
    ['What happens to files written by a transaction that never commits?', 'How would you assess compatibility before enabling a new table feature?'],
    'https://docs.delta.io/latest/delta-intro.html'),
  question('databricks', 2, 'MERGE and CDC', 'Apply out-of-order changes without regression', 'Coding', 12,
    'A CDC batch contains several updates per customer, duplicates, and deletes. Design a Delta MERGE that respects source sequence and discuss ambiguous source matches and replay.',
    [
      'Deduplicate the incoming batch to one intended action per target key using a deterministic source sequence and tie rule before MERGE. Multiple source rows that attempt to update the same target can be ambiguous, and exact duplicate-match evaluation varies by runtime, so do not rely on accidental behavior. Match on the stable business key and update only when the incoming sequence is newer. Use explicit columns to protect against unexpected schema changes.',
      'Retain a deletion version or durable tombstone when older updates can arrive later; physically removing the target without remembering its last sequence can allow resurrection. Make replay harmless by comparing versions and use a batch ledger when needed. Restrict target scanning with valid business predicates, but never exclude legitimate matches merely for speed. Test duplicate source keys, equal-version conflicts, late deletes, stale inserts, and a retry after the target commit but before the job reports success.',
    ],
    `MERGE INTO main.silver.customers AS target
USING deduplicated_changes AS source
ON target.customer_id = source.customer_id
WHEN MATCHED AND source.source_seq > target.source_seq THEN
  UPDATE SET name = source.name, source_seq = source.source_seq,
             is_deleted = source.is_deleted
WHEN NOT MATCHED THEN
  INSERT (customer_id, name, source_seq, is_deleted)
  VALUES (source.customer_id, source.name, source.source_seq, source.is_deleted);`, 'sql',
    ['MERGE does not define a business precedence rule for duplicate source keys.', 'Hard deletion without a retained version permits stale-event resurrection.'],
    ['How would you quarantine equal-sequence conflicting payloads?', 'Which target filter is safe when an update changes an old entity?'],
    'https://docs.databricks.com/aws/en/delta/merge'),
  question('databricks', 3, 'Medallion architecture', 'Give bronze, silver, and gold clear contracts', 'Design', 10,
    'Design a medallion pipeline for orders from APIs and files. Explain what each layer guarantees, how rejected records and deletes flow, and why copying the same data three times is not enough.',
    [
      'Bronze preserves source fidelity and ingestion metadata so data can be audited and replayed. Silver applies typed schemas, identity rules, deduplication, quality checks, and a consistent change contract. Gold exposes business-ready grains and metrics with documented semantics. These are responsibility boundaries, not a requirement that every dataset be blindly duplicated into three tables. Keep source version, file identity, ingestion time, and processing run information where they help trace a reported number back to input.',
      'Define how malformed records are quarantined, which failures block publication, and how completeness is communicated. Deletes and corrections must propagate through derived layers, while raw retention follows an explicit access and privacy policy. Use idempotent transformations and a replay strategy that can rebuild downstream layers without changing identities unexpectedly. Validate each boundary with contracts and reconciliation. Choose materialization based on reuse, cost, and recovery needs; a small transformation may be a view, while a critical recovery boundary deserves durable storage.',
    ], '', 'sql',
    ['Layer names do not prove data quality or a correct fact grain.', 'A raw retention policy must also account for deletion and access obligations.'],
    ['Which metadata makes a gold metric traceable to a source file?', 'When would you skip a physical materialization between layers?'],
    'https://docs.databricks.com/aws/en/lakehouse/medallion'),
  question('databricks', 4, 'Auto Loader', 'Ingest files with a recoverable discovery state', 'Coding', 12,
    'Design Auto Loader ingestion for a growing object-store prefix with evolving JSON. Explain cloudFiles, schema tracking, checkpoints, immutable files, and available-now backfills.',
    [
      'Auto Loader incrementally discovers files and exposes them through the cloudFiles Structured Streaming source. In a standalone stream, use durable, separate schema and checkpoint locations, explicit ingestion options, and a Delta target. Its tracked file state supports recovery, but it does not deduplicate identical business events delivered in different files. Prefer immutable source objects with stable identities, and preserve source metadata for auditing and reconciliation.',
      'Choose an evolution and rescued-data policy deliberately instead of allowing arbitrary new fields to redefine trusted silver data. Pipeline-managed execution can manage schema and checkpoint details differently, so follow the selected execution mode. An available-now trigger can process the currently available backlog and stop, fitting scheduled incremental ingestion. Control rate and file-size limits, protect the checkpoint from cleanup, and test a restart, a newly added field, a malformed type, and a backlog large enough to expose discovery and throughput costs.',
    ],
    `incoming = (spark.readStream.format("cloudFiles")
    .option("cloudFiles.format", "json")
    .option("cloudFiles.schemaLocation", schema_path)
    .load(source_path))
query = (incoming.writeStream
    .option("checkpointLocation", checkpoint_path)
    .trigger(availableNow=True)
    .toTable("main.bronze.order_events"))
query.awaitTermination()`, 'python',
    ['File-level ingestion guarantees do not deduplicate business events across different files.', 'Deleting a checkpoint is a state reset, not routine maintenance.'],
    ['How would you handle a producer overwriting an existing file?', 'Which schema changes should remain quarantined until reviewed?'],
    'https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/'),
  question('databricks', 5, 'Change data feed', 'Consume changes with a retention contract', 'Design', 12,
    'Use Delta change data feed to update a downstream customer mart. Explain change types, commit versions, update images, restartability, retention, and runtime-dependent CDF modes.',
    [
      'CDF exposes row changes with metadata such as change type and commit version, letting a consumer process inserts, deletes, and update images instead of repeatedly scanning a full table. Decide whether the downstream calculation needs both preimages and postimages or only the resulting state. Check the deployed runtime and table features: Databricks documents automatic and legacy CDF modes with different prerequisites, so enabling one historical table property is not a universal description of current behavior.',
      'Persist a compatible source progress point with idempotent downstream publication. Initial bootstrap and subsequent changes need a coordinated boundary so no version is skipped or counted twice. CDF is not an indefinite audit archive; retention and table maintenance can remove the history needed by a lagging consumer. Monitor consumer lag and maintain a full-snapshot recovery path. Test schema evolution, deletes, repeated processing, and a consumer restart after its required starting version is no longer available.',
    ],
    `changes = (spark.read.format("delta")
    .option("readChangeFeed", "true")
    .option("startingVersion", start_version)
    .option("endingVersion", end_version)
    .table("main.silver.customers"))
current_images = changes.filter("_change_type IN ('insert', 'update_postimage', 'delete')")`, 'python',
    ['Reading both update images as positive additions double-counts updates.', 'A lagging consumer can outlive the retained change history.'],
    ['How would you coordinate snapshot bootstrap with the first change version?', 'When do you need update preimages for an aggregate?'],
    'https://docs.databricks.com/aws/en/tables/features/change-data-feed'),
  question('databricks', 6, 'Unity Catalog', 'Design a governed catalog boundary', 'Design', 10,
    'Design Unity Catalog organization for development, production, and multiple data domains. Explain catalog/schema/table names, managed versus external data, grants, ownership, and lineage.',
    [
      'Use the catalog, schema, and object hierarchy to express meaningful environment and domain boundaries, then assign ownership to controlled groups or service identities. Grant only required access at suitable levels and plan how future objects inherit privileges. Managed and external tables differ in storage lifecycle and responsibility, so choose based on ownership and interoperability needs rather than treating them as interchangeable labels. Use governed storage credentials and external locations instead of embedding cloud keys in notebooks.',
      'Lineage helps trace supported data operations, but it does not replace documented business meaning or capture every action performed outside governed interfaces. Test access with the actual job run identity and compute access mode. Include volumes, functions, models, and exports in the governance review where applicable. Separate deployment privileges from routine processing privileges, audit effective grants, and ensure direct cloud-storage permissions do not bypass intended table policies. A clean naming convention is useful only when ownership and operating responsibilities are equally clear.',
    ],
    `GRANT USE CATALOG ON CATALOG production TO reporting_readers;
GRANT USE SCHEMA ON SCHEMA production.gold TO reporting_readers;
GRANT SELECT ON SCHEMA production.gold TO reporting_readers;`, 'sql',
    ['Table grants do not help if the principal lacks required catalog or schema usage.', 'Direct storage access can bypass a carefully designed SQL privilege boundary.'],
    ['When should a domain own an external table instead of a managed table?', 'How would you verify the job runs under the intended principal?'],
    'https://docs.databricks.com/aws/en/data-governance/unity-catalog/'),
  question('databricks', 7, 'Jobs and orchestration', 'Build a recoverable task DAG', 'Design', 12,
    'Design a Lakeflow Jobs workflow with ingestion, validation, transformation, and publication. Discuss task dependencies, parameters, retries, repair runs, concurrency, and observable outcomes.',
    [
      'Represent real data dependencies as a task DAG and pass explicit run parameters such as source interval, batch ID, and target environment. Separate ingestion from publication so validation can block untrusted results. Define retry policies by failure category and make each task idempotent, since a repair or orchestrator retry may repeat work. Limit concurrent runs where they would contend for the same target or checkpoint, and use stable job identities rather than personal notebook state.',
      'Choose task compute from isolation, startup, reuse, and cost requirements, and set timeouts and notifications around meaningful service objectives. A successful notebook exit is not proof that expected rows arrived, so record counts, freshness, quality results, and source versions. Repair runs should preserve the original processing boundary and safely reuse completed outputs. Version job definitions with code, test permissions under the run-as principal, and rehearse a failure after a downstream write but before the task reports completion.',
    ], '', 'python',
    ['Retrying a task with a newly calculated date interval can process a different batch.', 'Concurrent runs must not share a streaming checkpoint.'],
    ['Which tasks are safe to repair independently?', 'How would you prevent two runs from publishing the same partition simultaneously?'],
    'https://docs.databricks.com/aws/en/jobs/'),
  question('databricks', 8, 'Lakeflow pipelines', 'Use declarative pipelines for data dependencies', 'Design', 10,
    'Compare a declarative Lakeflow pipeline with a notebook job. Explain streaming tables, materialized views, quality expectations, dependency discovery, and code with external side effects.',
    [
      'Lakeflow pipelines build on Spark Declarative Pipelines and let developers describe datasets and transformations while the framework manages dependency-driven execution and supporting operational state. Streaming tables and materialized views serve different incremental and refresh semantics, so choose from the source change model and result contract. Quality expectations can record, drop, or fail on invalid data according to the configured policy, but a quality rule still needs a clear business interpretation.',
      'Dataset definitions may be evaluated during planning or maintenance, so avoid arbitrary external writes and side effects inside declarative transformation functions. Keep ingestion contracts, keys, and ordering explicit when applying CDC or historical changes. Monitor the pipeline event information for freshness, dropped records, failures, and resource use. A job remains appropriate for broader orchestration and custom tasks outside the declarative data graph. Validate refresh and backfill behavior before assuming an edited definition will automatically repair every historical result.',
    ], '', 'python',
    ['Declarative dataset functions should not perform arbitrary external side effects.', 'Dropping invalid rows without a completeness policy can hide business data loss.'],
    ['When should an expectation fail instead of drop a record?', 'How would you rebuild a historical materialized result after changing business logic?'],
    'https://docs.databricks.com/aws/en/ldp/'),
  question('databricks', 9, 'Photon', 'Measure Photon coverage and price-performance', 'Scenario', 10,
    'A team enables Photon and expects every Python workload to accelerate. Explain its execution role, supported operations, fallback, UDF limitations, and how to evaluate the result.',
    [
      'Photon is a native vectorized execution engine for supported SQL and DataFrame operations. The query optimizer still plans the work, while Photon executes eligible operators in columnar batches. It does not turn arbitrary Python application code into native vectorized code. Unsupported operations can fall back to the Spark runtime, so inspect query profiles and actual operator coverage instead of assuming a checkbox proves the whole pipeline is accelerated.',
      'Compare end-to-end latency and total cost on the same representative inputs and concurrency. Include startup, data scanning, shuffles, writes, and time in Python or external services; a workload dominated by API calls may barely benefit. Prefer native expressions where they preserve semantics and expose optimization opportunities. Faster compute can reduce elapsed cost even with a different rate, but only measurements establish that. Check current runtime support for the specific operations and streaming pattern before making a platform-wide performance promise.',
    ], '', 'sql',
    ['Photon does not automatically accelerate arbitrary Python loops or network calls.', 'A faster operator does not guarantee a lower total job cost.'],
    ['How would a Python UDF affect your profile interpretation?', 'Which benchmark inputs would make the comparison credible?'],
    'https://docs.databricks.com/aws/en/compute/photon'),
  question('databricks', 10, 'Compute selection', 'Choose serverless or managed classic compute', 'Design', 10,
    'Select compute for a periodic ingestion job, a latency-sensitive BI dashboard, and a pipeline with specialized libraries and network requirements. Discuss serverless capabilities, constraints, and cost.',
    [
      'Choose compute from workload semantics, supported libraries, startup needs, isolation, networking, governance, and operational ownership. Serverless can reduce infrastructure management and improve elasticity, but its supported configurations and networking capabilities must be checked for the actual workspace and cloud. SQL warehouses fit governed interactive SQL, while jobs and pipelines have their own execution choices. A requirement for specialized runtime control may justify a different option even if serverless is available.',
      'Measure total latency and billed usage, including idle time, startup, retries, and concurrency, rather than comparing a single hourly rate. Validate access to external sources, secret handling, package compatibility, and observability before migration. Use policies, budgets, tags, and environment boundaries to keep experimentation accountable. Test the largest workload and a burst of concurrent requests. Avoid embedding infrastructure-specific assumptions in business transformations so compute can evolve without rewriting the pipeline’s correctness logic.',
    ], '', 'python',
    ['Serverless feature support varies by workload, workspace, cloud, and release.', 'A lower unit rate can still cost more when compute sits idle.'],
    ['Which network checks belong in a migration proof of concept?', 'How would you compare cost for a bursty workload?'],
    'https://docs.databricks.com/aws/en/compute/serverless/'),
  question('databricks', 11, 'Data layout', 'Choose liquid clustering from query evidence', 'Design', 12,
    'A large Delta table is partitioned by customer_id and has millions of tiny directories. Compare liquid clustering, static partitions, and Z-ordering, including compatibility and maintenance.',
    [
      'High-cardinality static partitioning can create small files and expensive directory management without useful pruning. Liquid clustering organizes table data around selected clustering keys and allows the layout strategy to evolve; its supported table and runtime requirements must be checked. It replaces rather than combines with static partitioning and Z-ordering on the same table. Choose keys from common selective filters and observed skipping behavior, not merely from the primary key.',
      'For existing tables, plan migration and downstream compatibility before changing protocol or layout features. Compaction and clustering consume compute and rewrite data, so schedule or automate maintenance according to observed benefit. More layout keys are not automatically better, especially when query patterns differ. Compare scanned bytes, file counts, latency, write amplification, and maintenance cost on representative workloads. Small tables may perform well with a simple unpartitioned layout; complexity should earn its place through measurable improvements.',
    ],
    `CREATE TABLE main.silver.events (
  event_id STRING, customer_id STRING, event_at TIMESTAMP, amount DECIMAL(18,2)
) USING DELTA
CLUSTER BY (customer_id, event_at);`, 'sql',
    ['Liquid clustering is not combined with static partitioning or ZORDER on the same table.', 'Choosing many keys can dilute layout effectiveness and increase maintenance work.'],
    ['How would you migrate an existing partitioned table?', 'Which profile metrics show that data skipping improved?'],
    'https://docs.databricks.com/aws/en/tables/clustering'),
  question('databricks', 12, 'Maintenance', 'Separate OPTIMIZE from VACUUM', 'Concept', 8,
    'A team runs VACUUM to fix small-file performance and OPTIMIZE to save storage. Explain the distinct jobs of each operation, their relationship to snapshots, and maintenance scheduling.',
    [
      'OPTIMIZE reorganizes eligible active data files, commonly compacting small files and applying the table’s supported layout strategy. It improves scan efficiency but can create replacement files while old files remain retained for readers and historical snapshots. VACUUM removes eligible unreferenced files after a retention threshold; it is storage cleanup, not a compaction or query-layout operation. Their effects and costs are different even when both belong in a maintenance plan.',
      'Schedule maintenance from file counts, write frequency, query patterns, and managed optimization capabilities rather than running every command after every tiny batch. Avoid overlapping expensive rewrites with peak workloads unless the service objectives allow it. Track scanned bytes, active file count, maintenance compute, and obsolete-file storage. Never use direct object deletion as a shortcut. Test retention and streaming-reader requirements before cleanup, and remember that compaction should preserve logical results even though physical file identities change.',
    ],
    `OPTIMIZE main.silver.events;
-- Review retention and active readers before running cleanup.
VACUUM main.silver.events DRY RUN;`, 'sql',
    ['VACUUM does not compact active small files.', 'OPTIMIZE can temporarily increase stored bytes while old files remain retained.'],
    ['When would managed predictive optimization simplify this schedule?', 'How would you verify compaction preserved business results?'],
    'https://docs.databricks.com/aws/en/delta/optimize'),
  question('databricks', 13, 'History and recovery', 'Use time travel without treating it as a backup', 'Scenario', 10,
    'An incorrect MERGE changed customer attributes yesterday. Explain history inspection, version-based queries, restoration, retention dependencies, and downstream consequences.',
    [
      'Inspect table history to identify the bad operation and the last valid snapshot, then query that version to validate the expected state. A version-based reference is useful for reproducible debugging because it names a specific table snapshot. Time travel depends on both usable transaction metadata and retained data files; a log entry alone cannot reconstruct files already removed. Do not assume that historical access remains available forever or across every clone and copy operation.',
      'A supported RESTORE can publish an earlier table state as a new operation, but downstream consumers may observe it as fresh changes and require reconciliation. Decide whether a full restore or targeted corrective merge better preserves legitimate updates made after the incident. Validate counts, keys, and important totals in an isolated check before publication. Maintain an independent recovery strategy for retention gaps, accidental table deletion, or broader failures. Document which source versions and downstream batches were affected.',
    ],
    `DESCRIBE HISTORY main.silver.customers;
SELECT customer_id, name
FROM main.silver.customers VERSION AS OF 120;
-- After validation and an explicit recovery decision:
-- RESTORE TABLE main.silver.customers TO VERSION AS OF 120;`, 'sql',
    ['Time travel cannot read historical data files that retention cleanup has removed.', 'Restoring yesterday can also remove valid changes made after yesterday.'],
    ['How would you perform a targeted repair instead of a full restore?', 'How might a streaming consumer react to restored data?'],
    'https://docs.databricks.com/aws/en/delta/history'),
  question('databricks', 14, 'Retention and VACUUM', 'Set retention from reader and recovery needs', 'Design', 10,
    'Storage costs are rising and someone proposes VACUUM RETAIN 0 HOURS. Explain the risks and design a retention policy for streaming readers, time travel, CDF, and recovery.',
    [
      'Retention must exceed the longest relevant reader, writer, outage, and recovery horizon with operational margin. Aggressive cleanup can remove files needed by active work, a lagging stream, historical queries, or change consumers. The safety check is not an inconvenience to disable casually. Inspect active jobs, consumer lag, table properties, and a dry-run inventory before changing policy, then estimate the actual savings rather than assuming all stored bytes are obsolete.',
      'Data-file retention and transaction-log retention are separate controls, and keeping one does not guarantee usable history without the other. Include clones, external consumers, legal retention, and deletion requirements in the lifecycle design. Metadata-only deletes may require a supported rewrite or purge step before old physical content can eventually be removed. Monitor cleanup results and failed consumers after changes. Keep recovery backups or reproducible source data appropriate to the business risk; retention cleanup deliberately reduces what can be recovered from the table itself.',
    ], '', 'sql',
    ['Zero-hour retention can break active readers and destroy recoverable history.', 'Keeping logs does not restore removed historical data files.'],
    ['How would a two-week consumer outage influence retention?', 'What extra step can be needed for metadata-only deletes?'],
    'https://docs.databricks.com/aws/en/tables/operations/vacuum'),
  question('databricks', 15, 'Schema evolution', 'Evolve schemas through an explicit contract', 'Scenario', 10,
    'A producer adds fields and changes amount from numeric to string. Explain enforcement versus evolution, scoped options, column mapping, downstream compatibility, and rescued data.',
    [
      'Schema enforcement protects a table from incompatible writes, while schema evolution permits selected changes under explicit rules. Adding a nullable field is different from changing a field’s meaning or type. Prefer operation-scoped evolution options and reviewable contracts over a session-wide setting that silently affects unrelated writes. Retain unexpected raw fields or rescued values so ingestion can continue under a documented policy without immediately promoting them into trusted analytical columns.',
      'Column mapping and other table features can enable supported rename or drop behavior, but they introduce protocol and client-compatibility considerations. A metadata change is not proof that every streaming reader, CDF consumer, dashboard, and external engine remains compatible. Stage changes in development, test old and new producer versions, and validate null rates and cast failures. For a semantic change such as currency units or numeric text, introduce a new versioned field and a migration plan instead of disguising it as a harmless schema update.',
    ], '', 'sql',
    ['Automatic evolution cannot determine whether a changed field still means the same thing.', 'A metadata-only rename may still affect readers and protocol compatibility.'],
    ['How would you deploy a renamed field with old consumers still running?', 'Which changes should fail ingestion rather than be rescued?'],
    'https://docs.databricks.com/aws/en/delta/update-schema'),
  question('databricks', 16, 'Bundles and CI/CD', 'Deploy jobs and pipelines as reviewable code', 'Design', 12,
    'Design CI/CD with Databricks bundles for development and production. Explain resource definitions, targets, identity, validation, testing, secrets, and deployment drift.',
    [
      'Bundles keep application code and supported resource definitions, such as jobs and pipelines, in a versioned project. Current documentation calls them Declarative Automation Bundles, formerly Databricks Asset Bundles. Use separate deployment targets and parameterized environment values so production resources are not edited manually after every release. Validate the bundle, run meaningful unit and integration checks, and deploy an immutable reviewed revision using an automation identity with scoped permissions.',
      'Keep credentials out of YAML and source control; reference managed secrets or approved identity mechanisms. Separate deployment authority from the identity that runs the workload, and verify both in the target workspace. Track deployment ownership and resource identity to avoid duplicate jobs or accidental adoption of unrelated resources. Test rollback and data-state compatibility because reverting code does not automatically undo a table protocol change or a completed backfill. Record the deployed revision with job runs for traceable operations.',
    ],
    `# Run from the reviewed bundle project using its configured identity.
databricks bundle validate -t dev
databricks bundle deploy -t dev
databricks bundle run -t dev orders_pipeline`, 'bash',
    ['Deploying a previous code revision does not reverse already-published data changes.', 'Manual production edits create drift from the reviewed bundle definition.'],
    ['How would you separate deployer and run-as privileges?', 'What makes a rollback unsafe after a protocol upgrade?'],
    'https://docs.databricks.com/aws/en/dev-tools/bundles/'),
  question('databricks', 17, 'Security', 'Protect PII through the whole data path', 'Design', 12,
    'A governed customer table contains sensitive personal data. Design access controls for analysts, service principals, raw files, notebooks, exports, and operational logs.',
    [
      'Start from data classification and specific access needs, then apply least-privilege grants and supported row filters or column masks where appropriate. Govern storage access as well as table access so users cannot bypass restrictions through a direct object path. Use service principals for production jobs, managed credentials, controlled ownership, and audited permission changes. Separate broad development access from production processing identities and validate policies on the actual compute and execution mode.',
      'Sensitive data can escape through notebook output, debug logs, quarantine files, copied tables, exports, and external destinations, so review those paths explicitly. Masking a query result does not erase raw data from storage or historical versions. Design retention and deletion workflows with Delta history, backups, and downstream copies in mind. Test access using representative personas and service identities, and retain audit evidence sufficient to explain who accessed or changed protected datasets. Avoid embedding sensitive literals in source-controlled examples or job parameters.',
    ], '', 'sql',
    ['A table mask does not secure an independently granted raw storage path.', 'Quarantine and debug output can become ungoverned copies of PII.'],
    ['How would you validate a deletion request across historical copies?', 'Which audit events would support an access investigation?'],
    'https://docs.databricks.com/aws/en/data-governance/unity-catalog/access-control'),
  question('databricks', 18, 'Cost and performance', 'Reduce cost with attribution and evidence', 'Scenario', 12,
    'A lakehouse bill doubled while data volume rose only ten percent. Explain your investigation across compute, SQL warehouses, maintenance, retries, storage, and query layout.',
    [
      'Attribute usage to jobs, warehouses, owners, environments, and time periods using billing and operational system data plus consistent tags. Separate unit-price changes from additional runtime, idle capacity, concurrency, retries, and maintenance. Compare cost per successful business unit, such as a million validated events, rather than only total spend. A failed run followed by a retry may double cost without changing the final row count.',
      'Find dominant contributors before tuning: idle interactive compute, oversized workers, poor pruning, repeated scans, tiny-file overhead, excessive refreshes, or unexpectedly retained data. Evaluate serverless and Photon with measured total price-performance rather than assumptions. Use auto-termination, budgets, ownership, scheduling, and workload isolation where appropriate, then verify freshness and reliability remain acceptable. Include compaction, clustering, and backfill cost in the model. Keep cost dashboards actionable by connecting a spike to a deployable configuration or code change and an accountable owner.',
    ], '', 'sql',
    ['Cheaper hourly compute can cost more if the workload runs much longer.', 'Cost per input row can hide rejected data and repeated failed runs.'],
    ['How would you compare two compute choices fairly?', 'Which tags and system-table joins would make chargeback useful?'],
    'https://docs.databricks.com/aws/en/admin/system-tables/billing'),
  question('databricks', 19, 'Backfills', 'Backfill history beside a live pipeline', 'Design', 12,
    'A new business rule requires eighteen months of reprocessing while the live stream continues. Design scope, source versions, checkpoint separation, publication, validation, and rollback.',
    [
      'Define an immutable source boundary, the affected business intervals, and the exact code revision before starting. Use separate backfill execution state and checkpoint locations, and avoid letting a historical query compete blindly with the live SLA. Write to isolated staging or a new table version when possible, validate business totals and keys, then publish through a controlled merge or replacement strategy. Stable event identities and version rules must prevent older backfill rows from overwriting newer live state.',
      'Chunk by a meaningful bounded range and record a manifest with progress, counts, checksums, and validation results so retries resume safely. Coordinate the handoff boundary between historical and live processing, including late events and deletes. Estimate compute, storage, CDF amplification, and downstream refresh effects before launch. Rehearse rollback and preserve the previous published state long enough to investigate. A successful backfill is demonstrated by reconciled business results and compatible consumers, not simply by every notebook finishing green.',
    ], '', 'python',
    ['Sharing the live checkpoint can corrupt or reset the production progress contract.', 'A historical backfill can overwrite newer live state without source-version precedence.'],
    ['How would you choose a cutover boundary?', 'How would downstream CDF consumers distinguish a correction from a new business event?'],
    'https://docs.databricks.com/aws/en/ldp/flows-backfill'),
  question('databricks', 20, 'Historical CDC and concurrency', 'Maintain SCD2 under concurrent late changes', 'Design', 15,
    'Two pipelines update customer history and a late CDC event falls inside an existing validity interval. Explain sequence ordering, interval repair, transaction scope, concurrency conflicts, and validation.',
    [
      'Define one durable business key, a total source ordering contract, and half-open validity intervals before implementing SCD2. A late event may split an existing interval and change which version historical facts reference; expiring only the current row is insufficient. Use supported declarative CDC capabilities when they match the contract, or stage the affected keys and derive their complete desired interval sequence. Deduplicate source changes and detect equal-sequence payload conflicts before publication.',
      'Coordinate writers so overlapping keys do not independently publish incompatible histories. Delta concurrency behavior depends on runtime, isolation, table features, and operations, so handle supported conflicts with a bounded whole-operation retry that rereads current state. Do not infer multi-target atomicity from one successful table commit. Validate non-overlap, one current version, stable surrogate identity, and fact coverage after repair. Preserve a change manifest and reconcile consumers that already used the superseded intervals. Test concurrent writers and late bridge changes deliberately.',
    ], '', 'sql',
    ['Retrying from stale staged intervals can reproduce a concurrency conflict or overwrite newer history.', 'Late changes can require interval splitting and fact reassignment.'],
    ['How would you partition writer ownership by key?', 'Which SCD2 invariants should block publication?'],
    'https://docs.databricks.com/aws/en/optimizations/isolation-level'),
];

const interviewDirectory=new URL('./interviews/',import.meta.url);
const interviewQuestions=readdirSync(interviewDirectory).filter(name=>name.endsWith('.json')).sort().flatMap(name=>JSON.parse(readFileSync(new URL(name,interviewDirectory),'utf8')));
const importedQuestions=parseCollection(readFileSync(new URL('./imports/linkedin-senior-de-622.md',import.meta.url),'utf8'));
export const questions = [...sql, ...postgres, ...python, ...pyspark, ...databricks,...interviewQuestions,...importedQuestions];

const studyMaterialDocument='30-day-data-engineering-interview-prep.md';
const studyMaterialBuffer=readFileSync(new URL(`./imports/${studyMaterialDocument}`,import.meta.url));
export const studyMaterials=[parseStudyMaterial(studyMaterialBuffer.toString('utf8'),{
  id:'senior-de-30-day',
  sourceDocument:studyMaterialDocument,
  hash:createHash('sha256').update(studyMaterialBuffer).digest('hex')
})];
