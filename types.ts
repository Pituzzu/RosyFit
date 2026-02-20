
export enum View {
  HOME = 'HOME',
  DIET = 'DIET',
  SHOPPING = 'SHOPPING',
  GOALS = 'GOALS',
  MEALS = 'MEALS',
  SETTINGS = 'SETTINGS',
  PROFILE = 'PROFILE'
}

export interface UserProfile {
  name: string;
  surname: string;
  birthDate: string;
  friends: Friend[];
  weight: number;
  height: number;
  bmi: number;
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
}

export interface GymSettings {
  isActive: boolean;
  days: string[]; // e.g., ["Lunedì", "Mercoledì"]
  timeOfDay: 'morning' | 'afternoon';
}
