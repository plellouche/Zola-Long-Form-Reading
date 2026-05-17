export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: string;
}
