import type { DatabaseState, StoredDocument, StoredUser } from "./storage";

export const DEMO_PASSWORD = "StudyMark123!";
export const DEMO_ACCOUNTS = [
  {
    email: "alex@studymark.app",
    displayName: "Alex Morgan",
    role: "USER",
    id: "user-alex",
  },
  {
    email: "sam@studymark.app",
    displayName: "Sam Taylor",
    role: "USER",
    id: "user-sam",
  },
  {
    email: "admin@studymark.app",
    displayName: "Jamie Chen",
    role: "ADMIN",
    id: "user-admin",
  },
] as const;

// This digest avoids keeping entered passwords in clear text. Browser-local demo
// credentials are not a production authentication or security boundary.
export async function passwordDigest(
  password: string,
  userId: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(`${userId}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createSeed(): Promise<DatabaseState> {
  const users: StoredUser[] = await Promise.all(
    DEMO_ACCOUNTS.map(async (account) => ({
      ...account,
      passwordDigest: await passwordDigest(DEMO_PASSWORD, account.id),
    })),
  );
  const definitions = [
    [
      "java-collections",
      "Java Collections",
      "Java",
      "A practical guide to lists, sets, maps, and choosing the right collection.",
    ],
    [
      "data-structures",
      "Data Structures",
      "Computer Science",
      "Build a strong foundation in arrays, linked lists, trees, and graphs.",
    ],
    [
      "database-fundamentals",
      "Database Fundamentals",
      "Databases",
      "Understand relational models, SQL, indexing, and reliable transactions.",
    ],
    [
      "system-design-basics",
      "System Design Basics",
      "System Design",
      "Explore the building blocks behind scalable, dependable applications.",
    ],
  ];
  const documents: StoredDocument[] = definitions.map(
    ([id, title, subject, description], index) => ({
      id: id!,
      title: title!,
      subject: subject!,
      description: description!,
      scope: "SHARED",
      status: "PUBLISHED",
      uploadedBy: "user-admin",
      pageCount: 20,
      sizeBytes: [25939, 25287, 24885, 25180][index],
      contentVersion: 1,
      createdAt: `2026-10-${25 - index}T10:00:00.000Z`,
      updatedAt: `2026-10-${25 - index}T10:00:00.000Z`,
      lastPage: 0,
      annotationCount: 0,
      sourceUrl: `/samples/${id}.pdf`,
    }),
  );
  documents.push({
    ...documents[0]!,
    id: "alex-java-notes",
    title: "Java Revision Notes",
    description: "My personal copy for focused interview preparation.",
    scope: "PERSONAL",
    status: "ACTIVE",
    uploadedBy: "user-alex",
    createdAt: "2026-10-27T10:00:00.000Z",
    updatedAt: "2026-10-27T10:00:00.000Z",
  });
  return {
    users,
    documents,
    progress: {
      "user-alex:java-collections": 3,
      "user-alex:data-structures": 1,
    },
    annotations: [
      {
        id: "alex-welcome-note",
        userId: "user-alex",
        documentId: "java-collections",
        type: "PAGE_NOTE",
        pageNumber: 1,
        selectedText: null,
        anchor: null,
        color: null,
        noteText:
          "Review the differences between List, Set, and Map before the next practice session.",
        rowVersion: 1,
        createdAt: "2026-10-28T10:00:00.000Z",
        updatedAt: "2026-10-28T10:00:00.000Z",
      },
    ],
  };
}
