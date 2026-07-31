import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";
const REQUEST_TIMEOUT_MS = 20_000;

const isNative  =  Capacitor.isNativePlatform();

let authToken: string | null = null;

export async function setAuthToken(token: string | null) {
  authToken = token;
  if(!isNative) return;  // web relies entirely on the httpOnly cookie for auth
  if(token) {
    await Preferences.set({ key: "nutriai_token", value: token });
  } else {
    await Preferences.remove({ key: "nutriai_token" });
  }
}

export async function getAuthToken(): Promise<string | null> {  
  if(!isNative) return null;  // web never attaches as Authorization header
  if(authToken) return authToken;
  const { value } = await Preferences.get({ key: "nutriai_token" });
  authToken = value;
  return authToken;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  dietType: string;
  planType: string;
  parentId?: string | null;
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
  fibreGoal: number;
  waterGoal: number;
  weeklyBudget: number;
  budgetPeriod: "weekly" | "monthly";
  aiUsageCount: number;
  lastAiUsageDate?: string;
  createdAt: string;
  streaks?: {
    currentCount: number;
    longestCount: number;
  };
}

export type UpdateProfileInput = Partial<
  Pick<
    User,
    | "name"
    | "avatarUrl"
    | "dietType"
    | "calorieGoal"
    | "proteinGoal"
    | "carbGoal"
    | "fatGoal"
    | "fibreGoal"
    | "weeklyBudget"
    | "budgetPeriod"
  >
> & { timezone?: string; };

export interface Meal {
  id: string;
  userId: string;
  foodItemId?: string;
  customName?: string;
  quantity?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  iron: number;
  calcium: number;
  vitaminB12: number;
  mealType: string;
  eatenAt: string;
  aiParsed: boolean;
  aiConfidence?: number;
  imageUrl?: string | null;
  foodItem?: {
    name: string;
    imageUrl?: string | null;
  };
  triggerTags?: string[];
  mood?: string;
  hungerLevel?: number;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAuthToken(): Promise<boolean> {
  if(!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include", // web -> refresh token cookies goes along automatically
          headers: {
            "Content-Type": "application/json",
            // native -> send the current token in the body
          },
          body: isNative ? JSON.stringify({ refreshToken: authToken }): undefined,
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data.token) await setAuthToken(data.token);
          return true;
        } catch {
          return false;
        } finally {
          refreshInFlight = null;
        }
    })();
  }
  return refreshInFlight;
}


async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  _retried = false
): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response =  await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: "include", // for cookies (refresh token)
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please check your internet connection and try again.");
    }
    throw new Error(`Network request failed. Please check your connection and try again`);
  } finally {
    clearTimeout(timeoutId);
  }

  if(response.status === 401 && endpoint !== "/auth/refresh" && !_retried){
    const refreshed =  await refreshAuthToken();
    if(refreshed) {
      return apiFetch<T>(endpoint, options, true);
    }
    await setAuthToken(null);
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const authApi = {
  register: (data: { name: string; email: string; password: string; dietType?: string }) =>
    apiFetch<{ user: User; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    apiFetch<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  googleLogin: (idToken: string) =>
    apiFetch<{ user: User; token: string; isNewUser: boolean }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    }),

  me: () => apiFetch<User>("/auth/me"),

  updateProfile: (data: UpdateProfileInput) =>
    apiFetch<User>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

export const mealsApi = {
  list: (params?: { date?: string; startDate?: string; endDate?: string; mealType?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.set(key, String(value));
      });
    }
    return apiFetch<{ meals: Meal[]; total: number }>(`/meals?${searchParams.toString()}`);
  },

  today: () => apiFetch<{ meals: Meal[]; totals: any; goals: any; mealCount: number }>("/meals/today"),

  week: () => apiFetch<{ weekData: any[]; totalMeals: number }>("/meals/week"),

  create: (meal: Partial<Meal>) =>
    apiFetch<Meal>("/meals", {
      method: "POST",
      body: JSON.stringify(meal),
    }),

  analyze: (data: { description?: string; image?: string }) =>
    apiFetch<{ items: any[] }>("/meals/analyze", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  calculate: (data: { itemsText: string }) =>
    apiFetch<{ items: any[]; totalCalories: number }>("/meals/calculate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  bulkCreate: (data: { items: any[]; mealType: string; isOutside?: boolean; cost?: number; source?: string; triggerTags?: string[]; mood?: string; hungerLevel?: number }) =>
    apiFetch<{ meals: Meal[]; totalCalories: number }>("/meals/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const mealTemplatesApi = {
  list: () => apiFetch<any[]>("/meals/templates"),
  logFromTemplate: (id: string, mealType: string) =>
    apiFetch<Meal[]>(`/meals/templates/${id}/log`, {
      method: "POST",
      body: JSON.stringify({ mealType }),
    }),
};
