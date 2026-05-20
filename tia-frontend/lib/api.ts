const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Auth error event emitter for notifying AuthContext of 401 errors
type AuthErrorListener = () => void;
const authErrorListeners: Set<AuthErrorListener> = new Set();

export function onAuthError(listener: AuthErrorListener): void {
  authErrorListeners.add(listener);
}

export function offAuthError(listener: AuthErrorListener): void {
  authErrorListeners.delete(listener);
}

function emitAuthError(): void {
  authErrorListeners.forEach((listener) => listener());
}

type ApiErrorPayload = {
  detail?: unknown;
  message?: unknown;
  errors?: unknown;
};

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
  details?: string;
}

function getErrorMessage(
  status: number,
  data: unknown,
  defaultMessage: string
): string {
  const payload = isApiErrorPayload(data) ? data : {};

  // Handle specific error responses from server
  if (payload.detail) {
    return typeof payload.detail === "string"
      ? payload.detail
      : Array.isArray(payload.detail)
        ? payload.detail.map(formatValidationDetail).join(", ")
        : String(payload.detail);
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (payload.errors) {
    return Array.isArray(payload.errors)
      ? payload.errors.map(String).join(", ")
      : String(payload.errors);
  }

  // Status-based error messages
  switch (status) {
    case 400:
      return "Invalid request. Please check your input and try again.";
    case 401:
      return "Authentication failed. Please log in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "This item already exists or there's a conflict. Please try again.";
    case 422:
      return "The data you provided is invalid. Please check and try again.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
      return "Server error. Please try again later.";
    case 503:
      return "Service is temporarily unavailable. Please try again later.";
    default:
      return defaultMessage;
  }
}

export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  } as Record<string, string>;

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      // Handle 401 - only clear token and notify if we HAD a token
      // This prevents login failures from triggering auth error handlers
      if (response.status === 401 && typeof window !== "undefined" && token) {
        localStorage.removeItem("token");
        emitAuthError();
      }

      const errorMessage = getErrorMessage(
        response.status,
        data,
        "An error occurred. Please try again."
      );

      return {
        error: errorMessage,
        status: response.status,
        details: getErrorDetails(data),
      };
    }

    return {
      data: data as T,
      status: response.status,
    };
  } catch (err) {
    // Check if it's a network error (backend unreachable)
    const errorMessage =
      err instanceof Error 
        ? err.message.includes("fetch") || err.message.includes("Failed") || err.message.includes("NetworkError")
          ? "Unable to connect to the server. Please check your connection and try again."
          : err.message 
        : "Network error. Please try again.";

    return {
      error: errorMessage,
      status: 0,
    };
  }
}

export async function login(
  email: string,
  password: string
): Promise<ApiResponse<{ access_token: string; token_type: string }>> {
  const formData = new FormData();
  formData.append("username", email);
  formData.append("password", password);

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      body: formData,
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMessage = getErrorMessage(
        response.status,
        data,
        "Login failed. Please check your email and password."
      );

      return {
        error: errorMessage,
        status: response.status,
      };
    }

    return {
      data: data as { access_token: string; token_type: string },
      status: response.status,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Login failed. Please try again.",
      status: 0,
    };
  }
}

export async function getCurrentUser<T>(): Promise<ApiResponse<T>> {
  return apiCall<T>("/api/auth/me");
}

export async function createUser(userData: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  department?: string;
  rit_id?: string;
}): Promise<ApiResponse<unknown>> {
  return apiCall("/api/users", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export async function getTiaProfiles(
  userId: number
): Promise<ApiResponse<never[]>> {
  return apiCall(`/api/users/${userId}/tia-profiles/`);
}

export async function createTiaProfile(
  userId: number,
  profileData: {
    name: string;
    description?: string;
    system_prompt: string;
    tone: string;
    expertise_area?: string;
    is_default?: boolean;
  }
): Promise<ApiResponse<never>> {
  return apiCall(`/api/users/${userId}/tia-profiles/`, {
    method: "POST",
    body: JSON.stringify(profileData),
  });
}

export async function updateTiaProfile(
  userId: number,
  profileId: number,
  profileData: Partial<{
    name: string;
    description: string;
    system_prompt: string;
    tone: string;
    expertise_area: string;
    is_default: boolean;
  }>
): Promise<ApiResponse<unknown>> {
  return apiCall(`/api/users/${userId}/tia-profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(profileData),
  });
}

export async function deleteTiaProfile(
  userId: number,
  profileId: number
): Promise<ApiResponse<unknown>> {
  return apiCall(`/api/users/${userId}/tia-profiles/${profileId}`, {
    method: "DELETE",
  });
}

export async function getProjects(): Promise<ApiResponse<never[]>> {
  return apiCall("/api/projects/");
}

export async function getProject(projectId: number): Promise<ApiResponse<never>> {
  return apiCall(`/api/projects/${projectId}`);
}

export async function createProject(projectData: {
  title: string;
  description?: string;
  course_code?: string;
  faculty_supervisor_id?: number;
  status: string;
  main_deadline?: string;
}): Promise<ApiResponse<unknown>> {
  return apiCall("/api/projects/", {
    method: "POST",
    body: JSON.stringify({
      ...projectData,
      main_deadline: toApiDateTime(projectData.main_deadline),
    }),
  });
}

export async function updateProject(
  projectId: number,
  projectData: Partial<{
    title: string;
    description: string;
    course_code: string;
    faculty_supervisor_id: number;
    status: string;
    main_deadline: string;
  }>
): Promise<ApiResponse<never>> {
  return apiCall(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...projectData,
      main_deadline: toApiDateTime(projectData.main_deadline),
    }),
  });
}

export async function deleteProject(projectId: number): Promise<ApiResponse<unknown>> {
  return apiCall(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function getTasks(projectId: number): Promise<ApiResponse<never[]>> {
  return apiCall(`/api/projects/${projectId}/tasks/`);
}

export async function createTask<T = never>(
  projectId: number,
  taskData: {
    title: string;
    description?: string;
    type: string;
    due_date?: string;
    priority: string;
    estimated_minutes?: number;
  }
): Promise<ApiResponse<T>> {
  return apiCall(`/api/projects/${projectId}/tasks/`, {
    method: "POST",
    body: JSON.stringify({
      ...taskData,
      project_id: projectId,
      due_date: toApiDateTime(taskData.due_date),
    }),
  });
}

export async function getConversations(): Promise<ApiResponse<never[]>> {
  return apiCall("/api/conversations/");
}

export async function createConversation(conversationData: {
  project_id: number;
  tia_profile_id: number;
  title: string;
}): Promise<ApiResponse<{ conversation_id?: number }>> {
  return apiCall("/api/conversations/", {
    method: "POST",
    body: JSON.stringify(conversationData),
  });
}

export async function getConversation(
  conversationId: number
): Promise<ApiResponse<never>> {
  return apiCall(`/api/conversations/${conversationId}`);
}

export async function getMessages(
  conversationId: number
): Promise<ApiResponse<never[]>> {
  return apiCall(`/api/conversations/${conversationId}/messages/`);
}

export async function sendMessage<T = never>(
  conversationId: number,
  messageData: {
    content: string;
    sender_type: string;
    message_role?: string;
  }
): Promise<ApiResponse<T>> {
  return apiCall(`/api/conversations/${conversationId}/messages/`, {
    method: "POST",
    body: JSON.stringify({
      ...messageData,
      conversation_id: conversationId,
    }),
  });
}

function toApiDateTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  return value.includes("T") ? value : `${value}T00:00:00`;
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return typeof value === "object" && value !== null;
}

function formatValidationDetail(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "msg" in value &&
    typeof value.msg === "string"
  ) {
    return value.msg;
  }

  return String(value);
}

function getErrorDetails(data: unknown): string | undefined {
  if (!isApiErrorPayload(data) || !data.errors) return undefined;
  return JSON.stringify(data.errors);
}
