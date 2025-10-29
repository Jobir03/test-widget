export interface ServerMessage {
  id: string;
  text: string;
  isAdmin: boolean;
  products: Product[];
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
export interface Dimensions {
  width: number | null;
  height: number | null;
  length: number | null;
  depth: number | null;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  product_url: string;
  image_urls: string[];
  warranty: string | null;
  material: string | null;
  roomTypes: string[];
  description: string;
  type: string | null;
  color: string | null;
  dimensions: Dimensions;
  createdAt: string;
  updatedAt: string;
  price: number | null;
}

export interface ChatMessage {
  id: string; // server UUID
  from: "user" | "bot";
  text: string;
  images: string[];
  products: Product[];
  timestamp: Date;
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}
