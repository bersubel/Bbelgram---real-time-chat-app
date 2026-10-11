export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url?: string
}

export interface Chat {
  id: string
  is_group: boolean
  group_name?: string
  group_avatar_url?: string
  created_at: string
}

export interface ChatMember {
  chat_id: string
  user_id: string
  joined_at: string
  profile?: Profile // Joined data
}

export interface Message {
  id: string
  chat_id: string
  content: string
  sender_id: string
  created_at: string
  file_url?: string
  file_type?: string
  file_name?: string
}

export type ChatTab = 'personal' | 'groups' | 'edit'