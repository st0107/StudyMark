import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';

// Original, selectable-text study fixtures. No third-party PDFs are bundled.
const courses = [
  { slug: 'java-collections', title: 'Java Collections', subject: 'JAVA', topics: [
    ['The collections framework', 'A collection groups objects so that an application can store, retrieve, and process them consistently. Java provides interfaces for common behaviors and implementations with different performance characteristics.', 'List preserves element order and allows duplicates. Set represents unique elements. Map associates each key with a value. Choose the interface from the problem, then choose an implementation from its workload.'],
    ['Lists and ordered data', 'An ArrayList stores references in a resizable array. Access by index is constant time, while inserting into the middle generally shifts later elements. Appending is amortized constant time.', 'A LinkedList connects individual nodes. Inserting beside a known node is cheap, but finding the position still requires traversal. Locality and allocation costs matter when comparing real workloads.'],
    ['Maps and hashing', 'HashMap uses hashing to determine where entries are stored. Keys that map to the same bucket cause a collision, so equality and hash-code behavior must agree. Equal keys must produce equal hash codes.', 'A hash map offers expected constant-time lookup under suitable hashing. A sorted map maintains key order and supports range queries, with a different cost model. Never depend on HashMap iteration order.'],
    ['Sets and identity', 'A set answers whether an element is already present. HashSet uses hash-based membership, LinkedHashSet retains insertion order, and TreeSet maintains a sorted order.', 'Mutable fields used by equals or hashCode should not change while an object is a key in a hash-based collection. Otherwise a lookup can fail even though the object still occupies a bucket.'],
    ['Iteration and safe changes', 'Iteration lets code traverse a collection without depending on its storage layout. Use an iterator when removal is part of a traversal and the implementation supports it.', 'A fail-fast iterator is a diagnostic aid, not a synchronization strategy. Concurrent access needs an appropriate collection or explicit coordination. Measure workloads before optimizing.'],
  ] },
  { slug: 'data-structures', title: 'Data Structures', subject: 'COMPUTER SCIENCE', topics: [
    ['Choosing a representation', 'A data structure organizes values around the operations a program performs most often. Start with the required operations, expected input size, and memory constraints.', 'Big-O notation describes asymptotic growth. Constants, allocation patterns, and cache locality still affect performance at practical input sizes. Explain both the model and the assumptions.'],
    ['Arrays and linked lists', 'Arrays place elements in contiguous indexed positions. Linked lists represent a sequence through explicit references between nodes. Their tradeoffs become clear when comparing access, insertion, and traversal.', 'An array supports direct access by index. A linked list requires walking references to reach an arbitrary position. Inserting a node is cheap only when the insertion location is already known.'],
    ['Stacks and queues', 'A stack exposes last-in, first-out operations. A queue exposes first-in, first-out operations. These constraints make both structures useful for reasoning about algorithm state.', 'Use a stack for nested work such as parsing or depth-first traversal. Use a queue for breadth-first traversal or a worklist where tasks should be considered in arrival order.'],
    ['Trees and search', 'A tree represents hierarchical relationships without cycles. In a binary search tree, key ordering constrains which subtree can contain a target value.', 'Search cost depends on height. A balanced tree keeps height logarithmic, while a poorly shaped tree can behave like a linked list. Describe the balancing strategy when making guarantees.'],
    ['Graphs and traversal', 'A graph models entities as vertices and relationships as edges. Direction, weight, and connectivity determine which algorithms fit the question.', 'Breadth-first search finds shortest paths by edge count in an unweighted graph. Track visited vertices to avoid repeated work and infinite traversal around cycles.'],
  ] },
  { slug: 'database-fundamentals', title: 'Database Fundamentals', subject: 'DATABASES', topics: [
    ['Relational foundations', 'A relational database represents information as tables with defined columns and constraints. Keys give rows identity and relationships connect related records.', 'A primary key identifies a row. A foreign key constrains references to another table. Nullability and uniqueness should reflect real domain rules rather than convenience.'],
    ['Queries and joins', 'SQL describes the desired result as a relation. Filtering narrows the rows, projection chooses columns, and joins combine rows using a relationship or matching condition.', 'An inner join returns matching rows. An outer join can preserve rows without a match. Check multiplicity carefully: a one-to-many relationship may expand the result set.'],
    ['Indexes and access paths', 'An index helps the database locate candidate rows without scanning an entire table. Its benefit depends on the query, selectivity, column order, and available statistics.', 'Indexes consume storage and add work to writes. Use the execution plan to understand whether an index helps a real query. Avoid adding indexes without a workload to justify them.'],
    ['Transactions and consistency', 'A transaction groups related changes into a logical unit. Atomicity ensures that a committed group is applied together, while durability preserves committed results through supported failures.', 'Isolation controls how concurrent transactions observe one another. Select a level based on the anomalies the application must prevent, and understand the database-specific behavior.'],
    ['Schema design', 'Normalization reduces undesirable dependencies and repeated facts. A well-designed schema makes valid states easy to express and invalid states difficult to store.', 'Denormalization can improve a measured read path but creates consistency work. Keep the source of truth clear and document how derived data is refreshed or repaired.'],
  ] },
  { slug: 'system-design-basics', title: 'System Design Basics', subject: 'SYSTEM DESIGN', topics: [
    ['Start with requirements', 'System design begins by clarifying what the system does and which constraints matter. Separate functional behavior from capacity, reliability, latency, and operational requirements.', 'Estimate traffic and data size using explicit assumptions. A useful estimate exposes tradeoffs and uncertainty; it does not pretend to be a precise measurement.'],
    ['Services and boundaries', 'A service boundary groups responsibilities behind a contract. Good boundaries reduce coupling and keep ownership clear when behavior changes.', 'A modular monolith can be an effective starting point. Distributed services introduce network failures, deployment coordination, and observability requirements that must be justified.'],
    ['Caching and freshness', 'A cache stores reusable results closer to where they are needed. It trades storage and invalidation complexity for lower latency or reduced load on a slower dependency.', 'Define what happens on a miss, when entries expire, and how stale data affects users. Cache failure should be considered alongside the success path.'],
    ['Reliable request handling', 'Networks can lose responses even when a server completed its work. A client retry may therefore repeat an operation unless the API has a safe replay strategy.', 'Use idempotency where duplicate work would be harmful. Bound retries and use backoff, timeouts, and clear failure feedback so overload does not amplify itself.'],
    ['Observability and change', 'Logs, metrics, and traces provide different views of a running system. Select signals that connect user-visible behavior to the components responsible for it.', 'Measure before optimizing. Roll out changes gradually when possible, monitor the expected signals, and keep a clear recovery plan for changes that regress behavior.'],
  ] },
];

const dir = new URL('../public/samples/', import.meta.url);
await mkdir(dir, { recursive: true });
function wrap(text, font, size, width) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
for (const course of courses) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(course.title); pdf.setAuthor('StudyMark'); pdf.setSubject('Original study and annotation demo material');
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  for (let i = 0; i < 20; i++) {
    const page = pdf.addPage([612, 792]);
    const topic = course.topics[i % course.topics.length];
    const section = Math.floor(i / course.topics.length);
    const heading = section === 0 ? topic[0] : `${['', 'Review', 'Practice', 'Reflection'][section]}: ${topic[0].toLowerCase()}`;
    const green = rgb(.15, .32, .25); const grey = rgb(.39, .44, .4);
    page.drawText('STUDYMARK  /  STUDY NOTES', { x: 58, y: 744, size: 9, font: bold, color: green });
    page.drawText(course.subject, { x: 58, y: 688, size: 9, font: bold, color: grey });
    page.drawText(course.title, { x: 58, y: 650, size: 29, font: serif, color: green });
    page.drawLine({ start: { x: 58, y: 631 }, end: { x: 554, y: 631 }, color: rgb(.83, .87, .82), thickness: 1 });
    let y = 597;
    for (const line of wrap(heading, bold, 17, 490)) { page.drawText(line, { x: 58, y, size: 17, font: bold, color: green }); y -= 25; }
    y -= 14;
    const paragraphs = section === 0 ? [topic[1], topic[2]] : [topic[1], topic[2], 'Explain this concept in your own words. Identify one example where it is useful and one assumption that would change the answer.'];
    for (const para of paragraphs) {
      for (const line of wrap(para, body, 11.5, 486)) { page.drawText(line, { x: 58, y, size: 11.5, font: body, color: grey }); y -= 20; }
      y -= 17;
    }
    y = Math.min(y - 12, 275);
    page.drawRectangle({ x: 58, y: y - 98, width: 496, height: 104, color: rgb(.94, .96, .91) });
    page.drawText('PAUSE & CONNECT', { x: 75, y: y - 17, size: 9, font: bold, color: green });
    for (const [j, line] of wrap('What is the key idea on this page? Highlight a sentence, then add a note describing how you would apply it in a real project.', body, 10.5, 455).entries()) page.drawText(line, { x: 75, y: y - 41 - j * 18, size: 10.5, font: body, color: grey });
    page.drawLine({ start: { x: 58, y: 65 }, end: { x: 554, y: 65 }, color: rgb(.88, .9, .86), thickness: .7 });
    page.drawText('Original demo material | Read. Highlight. Make it yours.', { x: 58, y: 44, size: 8, font: body, color: grey });
    page.drawText(`${String(i + 1).padStart(2, '0')} / 20`, { x: 516, y: 44, size: 8, font: body, color: grey });
  }
  const bytes = await pdf.save();
  await writeFile(new URL(`${course.slug}.pdf`, dir), bytes);
  console.log(`${course.slug}: ${bytes.length} bytes / 20 pages`);
}
// Rotated/cropped regression fixture for geometry checks.
const regression = await PDFDocument.create();
const font = await regression.embedFont(StandardFonts.Helvetica);
const page = regression.addPage([612, 792]);
page.setRotation(degrees(90)); page.setCropBox(36, 36, 540, 720);
page.drawText('Rotated page: persistent highlights use page-relative rectangles.', { x: 70, y: 650, size: 12, font });
page.drawText('A second selectable line verifies multiple selection rectangles.', { x: 70, y: 625, size: 12, font });
await writeFile(new URL('rotated-regression.pdf', dir), await regression.save());
