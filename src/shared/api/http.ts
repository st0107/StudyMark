import type { StudyDocument, StudyMarkApi } from "../types";
import { ApiError } from "./errors";

const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
  /\/$/,
  "",
);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "The server could not be reached. Check your connection and retry.",
      "NETWORK_ERROR",
      0,
    );
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    throw new ApiError(
      error.message || "The request could not be completed. Please retry.",
      error.code || "REQUEST_FAILED",
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

function idPath(id: string): string {
  return encodeURIComponent(id);
}

async function documents(path: string): Promise<StudyDocument[]> {
  const response = await request<
    StudyDocument[] | { content: StudyDocument[] }
  >(path);
  return Array.isArray(response) ? response : response.content;
}

/** The only transport boundary that changes when a Spring Boot API is connected. */
export const httpApi: StudyMarkApi = {
  async getSession() {
    try {
      return await request("/auth/me");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  login: (input) => request("/auth/login", json("POST", input)),
  register: (input) => request("/auth/register", json("POST", input)),
  logout: () => request("/auth/logout", json("POST")),
  updateProfile: (input) => request("/auth/me", json("PATCH", input)),
  listDocuments: (input) =>
    documents(
      `/documents?${new URLSearchParams({ scope: input.scope, ...(input.search ? { search: input.search } : {}), ...(input.subject ? { subject: input.subject } : {}) })}`,
    ),
  getDocument: (id) => request(`/documents/${idPath(id)}`),
  async getDocumentContent(id) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/documents/${idPath(id)}/content`, {
        credentials: "include",
      });
    } catch {
      throw new ApiError(
        "The PDF could not be loaded. Check your connection and retry.",
        "NETWORK_ERROR",
        0,
      );
    }
    if (!response.ok)
      throw new ApiError(
        "This PDF is unavailable or you no longer have access.",
        "CONTENT_UNAVAILABLE",
        response.status,
      );
    return response.blob();
  },
  uploadDocument(input) {
    const form = new FormData();
    form.set("file", input.file);
    form.set("title", input.title);
    form.set("subject", input.subject);
    return request(
      input.scope === "SHARED" ? "/admin/documents" : "/documents",
      { method: "POST", body: form },
    );
  },
  renameDocument: (id, title) =>
    request(`/documents/${idPath(id)}`, json("PATCH", { title })),
  deleteDocument: (id) => request(`/documents/${idPath(id)}`, json("DELETE")),
  listAdminDocuments: () => documents("/admin/documents"),
  setPublication: (id, status) =>
    request(
      `/admin/documents/${idPath(id)}/publication`,
      json("PATCH", { status }),
    ),
  listAnnotations: (documentId) =>
    request(`/documents/${idPath(documentId)}/annotations`),
  getAllAnnotations: () => request("/annotations"),
  createAnnotation: (documentId, input) =>
    request(
      `/documents/${idPath(documentId)}/annotations`,
      json("POST", input),
    ),
  updateAnnotation: (id, input) =>
    request(`/annotations/${idPath(id)}`, json("PATCH", input)),
  deleteAnnotation: (id) =>
    request(`/annotations/${idPath(id)}`, json("DELETE")),
  saveProgress: (documentId, page) =>
    request(
      `/documents/${idPath(documentId)}/progress`,
      json("PUT", { lastPage: page }),
    ),
};
