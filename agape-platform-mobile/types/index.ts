export interface User {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'super_admin' | 'camp_leader' | 'member' | 'guest';
  camp_id?: string | null;
  phone?: string | null;
  profile_image?: string | null;
  spiritual_gifts?: string[];
  joined_date?: string; // ISO Date string
  is_active?: boolean;
  last_login?: string | null; // ISO Date string
}

export interface Camp {
  _id: string;
  name: string;
  description?: string;
  leader_id?: string | null;
  leader?: User; // Populated by backend sometimes
  created_at?: string; // ISO Date string
  meeting_schedule?: any[]; // Define further if needed
  is_active?: boolean;
  members_count?: number; // Populated by backend
}

export interface Message {
  _id: string;
  content: string;
  sender_id: string;
  sender?: User; // Populated by backend
  recipient_type: 'ministry' | 'camp' | 'user';
  recipient_id?: string | null; // Camp ID or User ID
  recipient?: User | { name: string }; // Populated by backend
  message_type?: string;
  attachment_urls?: string[];
  is_announcement?: boolean;
  created_at: string; // ISO Date string
  is_deleted?: boolean;
  read_by?: string[];
  is_read?: boolean; // Added client-side or by backend based on current user
}

export interface Meeting {
  _id: string;
  title: string;
  description?: string;
  scheduled_start: string; // ISO Date string
  scheduled_end: string; // ISO Date string
  host_id: string;
  host?: User; // Populated by backend
  meeting_type: string;
  camp_id?: string | null;
  camp?: Camp; // Populated by backend
  camp_name?: string; // Populated by backend
  is_recurring?: boolean;
  recurring_pattern?: any; // Define further if needed
  meeting_link?: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string; // ISO Date string
  attendees?: string[];
  attendees_details?: User[]; // Populated by backend
  recording_url?: string | null;
  is_attending?: boolean; // Added client-side based on current user
  time_until?: string; // Added client-side for display
}

export interface MeetingMessage {
  _id: string;
  content: string;
  user_id: string;
  user?: { id: string; name: string; profile_image?: string | null }; // Populated by backend
  meeting_id: string;
  message_type?: string;
  attachment_urls?: string[];
  created_at: string; // ISO Date string
}

export interface PrayerRequest {
  _id: string;
  content: string;
  user_id: string;
  user?: User; // Populated by backend if not anonymous
  is_private?: boolean;
  is_anonymous?: boolean;
  camp_id?: string | null;
  camp_name?: string; // Populated by backend
  camp?: Camp; // Populated by backend
  created_at: string; // ISO Date string
  status: 'active' | 'answered' | 'archived';
  is_testimony?: boolean;
  praying_users?: string[];
  praying_users_details?: User[]; // Populated by backend
  testimony_content?: string | null;
  is_praying?: boolean; // Added client-side based on current user
  is_author?: boolean; // Added client-side based on current user
}

export interface Notification {
  _id: string;
  user_id: string;
  title: string;
  body: string;
  related_type?: 'meeting' | 'prayer_request' | 'message' | string; // Allow other types
  related_id?: string | null; // ObjectId converted to string
  created_at: string; // ISO Date string
  is_read: boolean;
}

// Add Auth types if not already defined
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone?: string;
  camp_id?: string | null; // Optional during registration
  // Add other optional fields if needed
}

export interface AuthResponse {
  access_token: string;
  user: User;
  // Add refresh_token if your backend uses it
}

// Add other necessary types (e.g., for API responses with pagination)
export interface PaginatedResponse<T> {
  items: T[]; // Or specific names like 'camps', 'meetings' etc.
  total: number;
  page: number;
  per_page: number;
  pages: number;
}
