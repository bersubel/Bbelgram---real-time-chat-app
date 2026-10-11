'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile, ChatTab } from '@/types/database'

interface ChatListProps {
  currentUser: Profile
  activeTab: ChatTab
  activeChatId: string | null
  setActiveChatId: (id: string) => void
}

export default function ChatList({ currentUser, activeTab, activeChatId, setActiveChatId }: ChatListProps) {
  const supabase = createClient()
  const [chats, setChats] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [dbError, setDbError] = useState<string | null>(null)

  // Add Contact states
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactUsername, setContactUsername] = useState('')
  const [addError, setAddError] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    const fetchChats = async () => {
      try {
        setDbError(null)

        const { data: myMembers, error: err1 } = await supabase
          .from('chat_members')
          .select('chat_id')
          .eq('user_id', currentUser.id)

        if (err1) throw err1
        if (!myMembers || myMembers.length === 0) {
          setChats([])
          setIsLoading(false)
          return
        }

        const chatIds = myMembers.map(m => m.chat_id)

        const { data: chatsData, error: err2 } = await supabase.from('chats').select('*').in('id', chatIds)
        if (err2) throw err2

        const { data: allMembers, error: err3 } = await supabase.from('chat_members').select('*').in('chat_id', chatIds)
        if (err3) throw err3

        const userIds = [...new Set(allMembers.map(m => m.user_id))]
        const { data: profiles, error: err4 } = await supabase.from('profiles').select('*').in('id', userIds)
        if (err4) throw err4

        const { data: messages, error: err5 } = await supabase.from('messages').select('*').in('chat_id', chatIds)
        if (err5) console.warn("Messages blocked by RLS:", err5)

        const seenUsers = new Set()
        const formattedChats: any[] = []

        chatsData.forEach(chat => {
          const chatMsgs = (messages || []).filter(m => m.chat_id === chat.id)
          const latestMsg = chatMsgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          
          // Calculate unread messages (messages sent by others where is_read is false)
          const unreadCount = chatMsgs.filter(m => m.sender_id !== currentUser.id && m.is_read === false).length

          let name = chat.group_name
          let avatar = chat.group_avatar_url

          if (!chat.is_group) {
            const otherMember = allMembers.find(m => m.chat_id === chat.id && m.user_id !== currentUser.id)
            
            // Deduplication Check: If we already have a direct chat with this user, skip showing the duplicate
            if (otherMember) {
              if (seenUsers.has(otherMember.user_id)) return 
              seenUsers.add(otherMember.user_id)
            }

            const profileData = profiles.find(p => p.id === otherMember?.user_id)
            name = profileData?.display_name || 'Unknown User'
            avatar = profileData?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random`
          } else if (!avatar) {
            avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Group')}&background=random`
          }

          formattedChats.push({ ...chat, display_name: name, avatar_url: avatar, latestMsg, unreadCount })
        })

        // Sort by most recent message
        formattedChats.sort((a, b) => {
          const timeA = a.latestMsg ? new Date(a.latestMsg.created_at).getTime() : new Date(a.updated_at || a.created_at || 0).getTime()
          const timeB = b.latestMsg ? new Date(b.latestMsg.created_at).getTime() : new Date(b.updated_at || b.created_at || 0).getTime()
          return timeB - timeA
        })

        setChats(formattedChats)
      } catch (err: any) {
        console.error("Error fetching chats:", err)
        setDbError(err.message || "Failed to load chats")
      } finally {
        setIsLoading(false)
      }
    }

    fetchChats()

    const channel = supabase.channel('chat_list_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchChats()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        fetchChats()
      }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUser.id, supabase, refreshTrigger])

  const filteredChats = chats.filter(chat => {
    // Cast activeTab as string here
    const matchesTab = (activeTab as string) === 'all' || (activeTab === 'personal' && !chat.is_group) || (activeTab === 'groups' && chat.is_group)
    const matchesSearch = chat.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })
  const formatTime = (dateString?: string) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return ''
      const today = new Date()
      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      return date.toLocaleDateString([], { weekday: 'short' })
    } catch (e) {
      return ''
    }
  }

  // Handle clicking a chat
  const handleChatClick = async (chatId: string) => {
    setActiveChatId(chatId)

    // Instantly mark as read in UI
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c))

    // Mark as read in Database
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('chat_id', chatId)
      .neq('sender_id', currentUser.id)
      .eq('is_read', false)
  }

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    setIsAdding(true)

    const cleanUsername = contactUsername.replace('@', '').trim()
    if (cleanUsername === currentUser.username) {
      setAddError("You cannot add yourself.")
      setIsAdding(false)
      return
    }

    try {
      const { data: targetProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .single()

      if (profileErr || !targetProfile) throw new Error("User not found.")

      const existingChat = chats.find(c => 
        !c.is_group && c.chat_members?.some((m: any) => m.user_id === targetProfile.id)
      )

      if (existingChat) {
        handleChatClick(existingChat.id)
        setShowAddContact(false)
        setContactUsername('')
        setIsAdding(false)
        return
      }

      const { data: newChat, error: chatErr } = await supabase
        .from('chats')
        .insert([{ is_group: false }])
        .select('id')
        .single()

      if (chatErr || !newChat) throw chatErr

      const { error: membersErr } = await supabase.from('chat_members').insert([
        { chat_id: newChat.id, user_id: currentUser.id, role: 'member' },
        { chat_id: newChat.id, user_id: targetProfile.id, role: 'member' }
      ])

      if (membersErr) throw membersErr

      setRefreshTrigger(prev => prev + 1)
      handleChatClick(newChat.id)
      setShowAddContact(false)
      setContactUsername('')
    } catch (err: any) {
      setAddError(err.message || "An error occurred")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="flex flex-col h-full relative">
      
      {/* Search Header */}
      <div className="px-4 py-3 bg-[#17212b] border-b border-[#101925] shrink-0">
        <div className="relative">
          <svg className="w-5 h-5 text-[#7f91a4] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-[#242f3d] text-white text-[14px] rounded-full pl-10 pr-4 py-2 outline-none focus:bg-[#1c2733] border border-transparent focus:border-[#5293d9] transition-colors"
          />
        </div>
      </div>

      {/* Loading / Error States */}
      {dbError ? (
        <div className="flex-1 p-6 text-red-400 text-sm text-center">
          <p className="font-semibold mb-2">Database Error:</p>
          {dbError}
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[#7f91a4] text-sm">Loading chats...</div>
      ) : filteredChats.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-[#242f3d] rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#7f91a4]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <p className="text-[#7f91a4] text-[14px]">{searchQuery ? 'No chats found.' : `No ${activeTab} chats yet.`}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#242f3d] scrollbar-track-transparent pb-20">
          {filteredChats.map(chat => {
            const isActive = chat.id === activeChatId
            const msg = chat.latestMsg
            const isMissedCall = msg?.file_name === 'missed'
            const isImage = msg?.file_type?.startsWith('image/')
            
            let snippet = msg?.content || 'No messages yet'
            if (isImage) snippet = '📷 Photo'
            if (msg?.file_type && !isImage && !msg.file_type.startsWith('call/')) snippet = `📎 ${msg.file_name}`

            return (
              <div 
                key={chat.id}
                onClick={() => handleChatClick(chat.id)}
                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors mx-2 my-1 rounded-xl ${
                  isActive ? 'bg-[#2b5278]' : 'hover:bg-[#202b36]'
                }`}
              >
                <img src={chat.avatar_url} alt={chat.display_name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={`font-medium truncate text-[15px] ${isActive ? 'text-white' : 'text-white'}`}>
                      {chat.display_name}
                    </h3>
                  </div>
                  <p className={`truncate text-[14px] ${isMissedCall && !isActive ? 'text-red-400 font-medium' : isActive ? 'text-blue-200' : 'text-[#7f91a4]'}`}>
                    {msg?.sender_id === currentUser.id && !isMissedCall && <span className="mr-1 text-[#5293d9]">You:</span>}
                    {snippet}
                  </p>
                </div>

                {/* Right Side: Time and Unread Badge */}
                <div className="flex flex-col items-end justify-between ml-2 shrink-0 space-y-1.5 min-w-[40px]">
                  <span className={`text-[12px] ${isActive ? 'text-blue-200' : 'text-[#7f91a4]'}`}>
                    {formatTime(msg?.created_at || chat.updated_at || chat.created_at)}
                  </span>
                  
                  {chat.unreadCount > 0 && !isActive && (
                    <div className="bg-[#4a8fc9] text-white text-[12px] font-semibold px-[7px] py-[2px] rounded-full min-w-[22px] text-center shadow-sm">
                      {chat.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating Action Button (New Chat) */}
      <button 
        onClick={() => setShowAddContact(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-[#5293d9] hover:bg-[#4784c4] text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-20"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#17212b] w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-[#242f3d]">
            <h2 className="text-white font-semibold text-[18px] mb-4">New Message</h2>
            <form onSubmit={handleAddContact}>
              <div className="flex items-center bg-[#242f3d] rounded-xl px-3 py-2 focus-within:border-[#5293d9] border border-transparent transition-colors">
                <span className="text-[#7f91a4] mr-1">@</span>
                <input
                  type="text"
                  value={contactUsername}
                  onChange={(e) => setContactUsername(e.target.value)}
                  placeholder="username"
                  className="flex-1 bg-transparent border-none text-white outline-none text-[15px]"
                  autoFocus
                />
              </div>
              {addError && <p className="text-red-400 text-[13px] mt-2">{addError}</p>}
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowAddContact(false)} className="px-4 py-2 text-white hover:bg-[#242f3d] rounded-lg transition-colors text-[14px]">Cancel</button>
                <button type="submit" disabled={isAdding || !contactUsername.trim()} className="px-4 py-2 bg-[#5293d9] hover:bg-[#4784c4] text-white rounded-lg transition-colors text-[14px] disabled:opacity-50">
                  {isAdding ? 'Searching...' : 'Start Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}