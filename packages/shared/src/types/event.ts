export type EventType =
  | 'OPEN'
  | 'FINISH'
  | 'SAVE'
  | 'DISMISS'
  | 'LINK_CLICK'
  | 'LIST_ADD'
  | 'FOLLOW'
  | 'UNFOLLOW';

export interface AppEvent {
  id: string;
  userId: string | null;
  articleId: string | null;
  eventType: EventType;
  metadata: Record<string, unknown>;
  createdAt: string;
}
