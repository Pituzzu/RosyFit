
export enum View {
  HOME = 'HOME',
  DIET = 'DIET',
  SHOPPING = 'SHOPPING',
  GOALS = 'GOALS',
  MEALS = 'MEALS',
  SETTINGS = 'SETTINGS',
  PROFILE = 'PROFILE',
  FRIEND_PROFILE = 'FRIEND_PROFILE'
}

export interface MealDetail {
  fullTitle: string;
  desc: string;
  kcal: number;
  carbs: number;
  protein: number;
  fats: number;
  isFree?: boolean;
}

export interface DayPlan {
  colazione: MealDetail;
  spuntino: MealDetail;
  pranzo: MealDetail;
  spuntino2?: MealDetail;
  cena: MealDetail;
}

export type WeeklyDiet = Record<string, DayPlan>;

export interface UserProfile {
  name: string;
  surname: string;
  birthDate: string;
  dietStartDate?: string;
  streak?: number;
  avatar?: string;
  friends: Friend[];
  weight: number;
  height: number;
  bmi: number;
  diet?: WeeklyDiet;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
}

export interface MealPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  imageUrl: string;
  mealType: string;
  description: string;
  timestamp: Date;
  isGymDay: boolean;
  likes?: string[]; // Array of user IDs
}

export interface Notification {
  id: string;
  userId: string; // Recipient
  fromUserId: string;
  fromUserName: string;
  type: 'like' | 'comment' | 'system';
  message: string;
  read: boolean;
  timestamp: Date;
  link?: string;
}

export interface News {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
  timestamp: Date;
}

export interface GymSettings {
  isActive: boolean;
  days: string[]; // e.g., ["Lunedì", "Mercoledì"]
  timeOfDay: 'morning' | 'afternoon';
}
