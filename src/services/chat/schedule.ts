import { getApiBase } from "./auth";
import { createApiClient } from "../api/apiClient";

export interface Branch {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  imageUrls: string[] | null;
}

export interface BranchesResponse {
  data: Branch[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateSchedulePayload {
  branchId: string;
  productId: string;
  bookedTime: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const scheduleService = {
  async getBranches(
    widgetKey: string,
    page: number = 1,
    limit: number = 10
  ): Promise<BranchesResponse> {
    const base = getApiBase();
    const client = createApiClient(base, widgetKey);
    const url = `/schedules/branches?page=${page}&limit=${limit}`;

    const data = await client.get<BranchesResponse>(url);
    return data;
  },

  async createSchedule(widgetKey: string, payload: CreateSchedulePayload) {
    const base = getApiBase();
    const client = createApiClient(base, widgetKey);
    const url = "/schedules";
    return client.post(url, payload);
  },
};
