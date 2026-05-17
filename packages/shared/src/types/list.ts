export interface ReadingList {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  forkedFromId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListItem {
  id: string;
  listId: string;
  articleId: string;
  position: number;
  addedAt: string;
}
