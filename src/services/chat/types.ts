export interface ServerMessage {
  id: string;
  text?: string; // Legacy support
  question?: string | null; // New field - replaces text for bot messages
  information?: string | null; // New field - replaces description
  isAdmin: boolean;
  products: Product[];
  createdAt: string;
  updatedAt: string;
  images: string[];
  widgetUserId: string;
  description?: string | null; // Legacy support
  widgetUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  type: string | null; // "recommend" | "qa" | "image_generation" | "booking"
  options: string[];
  schedule?: SchedulePayload | null;
  callRequest?: CallRequestPayload | null;
  product_photo_link?: string | null; // Product photo link for image_generation type
  generated_photo?: string | null; // Generated photo link for image_generation type
  room_image_link?: string | null; // Room image link for image_generation type
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

// Server response format for schedule (includes populated relations)
export interface ScheduleResponse {
  branchId?: string;
  productId?: string;
  bookedTime: string;
  firstName?: string;
  lastName?: string;
  contact?: string;
  customerName?: string;
  contactInfo?: string;
  branch?: {
    id: string;
    name: string;
  };
  product?: {
    id: string;
    name: string;
  };
  widgetUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    contact?: string;
  };
}

export interface CallRequestPayload {
  phoneNumber: string;
  name: string;
}

export type LoadingType = "schedule" | "callRequest" | "image" | "ai" | "roomGeneration";

export interface LoadingEvent {
  type: LoadingType;
  loading: boolean;
}

export interface ChatMessage {
  id: string; // server UUID
  from: "user" | "bot";
  text?: string; // Legacy support
  question?: string | null; // New field - replaces text for bot messages
  information?: string | null; // New field - replaces description
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
  type?: string | null; // "recommend" | "qa" | "image_generation" | "booking"
  options?: string[];
  schedule?: SchedulePayload | ScheduleResponse | null;
  callRequest?: CallRequestPayload | null;
  description?: string | null; // Legacy support
  showScheduleForm?: boolean; // Flag to show schedule form
  showCallMeForm?: boolean; // Flag to show call me form
  product_photo_link?: string | null; // Product photo link for image_generation type
  generated_photo?: string | null; // Generated photo link for image_generation type
  room_image_link?: string | null; // Room image link for image_generation type
}
