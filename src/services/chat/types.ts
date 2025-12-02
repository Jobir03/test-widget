export interface ServerMessage {
  id: string;
  text: string;
  isAdmin: boolean;
  products: Product[];
  createdAt: string;
  updatedAt: string;
  images: string[];
  widgetUserId: string;
  description: string | null;
  widgetUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  type: string | null;
  options: string[];
  schedule?: SchedulePayload | null;
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

export interface ProductImage {
  id: string;
  originalUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  product_url: string;
  image_urls?: string[];
  images?: ProductImage[];
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

export interface SchedulePayload {
  branchId: string;
  productId?: string; // Optional - product selection is optional
  bookedTime: string;
  firstName: string;
  lastName: string;
  contact: string; // Email or phone number
}

export interface ChatMessage {
  id: string; // server UUID
  from: "user" | "bot";
  text: string;
  images: string[];
  products: Product[];
  timestamp: Date;
  isAdmin?: boolean;
  isError?: boolean;
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
  type?: string | null;
  options?: string[];
  schedule?: SchedulePayload | null;
  description?: string | null;
  showScheduleForm?: boolean; // Flag to show schedule form
}
