export interface AssistantSession {
  sessionId: string;
  lastInteraction: Date;
  messages: {
    role: string;
    content: string;
  }[];
}
