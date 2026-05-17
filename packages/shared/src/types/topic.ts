export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
}

export interface UserTopic {
  userId: string;
  topicId: string;
  weight: number;
}
