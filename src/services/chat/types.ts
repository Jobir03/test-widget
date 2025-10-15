export interface ServerMessage {
  id: string;
  text: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  images: string[];
  widgetUserId: string;
  widgetUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    perPage: number;
    currentPage: number;
    totalPages: number;
  };
}

export interface ChatMessage {
  id: string; // server UUID
  from: "user" | "bot";
  text: string;
  images: string[];
  timestamp: Date;
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}
