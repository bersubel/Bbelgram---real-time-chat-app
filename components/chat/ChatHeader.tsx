'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'
import ChatProfileModal from '../modals/ChatProfileModal'

interface ChatHeaderProps {
  chatId: string
  currentUser: Profile
  onStartCall: (type: 'voice' | 'video', name: string, avatar: string) => void
}

export default function ChatHeader({ chatId, currentUser, onStartCall }: ChatHeaderProps) {
  const supabase = createClient()
  const [chatName, setChatName] = useState('Loading...')
  const [chatAvatar, setChatAvatar] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  
  // Track the other user for direct messages
  const [otherUserId, setOtherUserId] = useState<string | null>(null)
  
  const [showMenu, setShowMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchChatDetails = async () => {
      const { data: chat } = await supabase
        .from('chats')
        .select(`
          is_group, group_name, group_avatar_url,
          chat_members ( user_id, profiles ( display_name, avatar_url ) )
        `)
        .eq('id', chatId)
        .single()

      if (chat) {
        setIsGroup(chat.is_group)
        if (chat.is_group) {
          setChatName(chat.group_name || 'Unnamed Group')
          setChatAvatar(chat.group_avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.group_name || 'G')}&background=random`)
          setMemberCount(chat.chat_members.length)
        } else {
          const otherMember = chat.chat_members.find((m: any) => m.user_id !== currentUser.id)
          const p = otherMember?.profiles
          const otherProfile = (Array.isArray(p) ? p[0] : p) as any // <-- Added "as any" here
          
          setChatName(otherProfile?.display_name || 'Unknown User')
          setChatAvatar(otherProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherProfile?.display_name || 'U')}&background=random`)
          setMemberCount(null)
          setOtherUserId(otherMember?.user_id || null)
        }
      }
    }
    fetchChatDetails()
  }, [chatId, currentUser.id, supabase])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <div className="h-[60px] bg-[#17212b] border-b border-[#101925] flex items-center justify-between px-5 shrink-0 z-20 shadow-sm relative">
        
        {/* Clickable Profile Area */}
        <div 
          onClick={() => setShowProfileModal(true)}
          className="flex items-center gap-3 cursor-pointer hover:bg-white/5 py-1.5 px-2 -ml-2 rounded-lg transition-colors"
        >
          {chatAvatar && <img src={chatAvatar} alt={chatName} className="w-10 h-10 rounded-full object-cover" />}
          <div className="flex flex-col">
            <h2 className="text-white font-semibold text-[15px]">{chatName}</h2>
            <span className="text-[#7f91a4] text-[13px]">
              {memberCount ? `${memberCount} members` : 'last seen recently'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-[#7f91a4]">
          <button onClick={() => onStartCall('voice', chatName, chatAvatar)} className="hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </button>
          
          <button onClick={() => onStartCall('video', chatName, chatAvatar)} className="hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          
          {/* 3-Dots Menu */}
          <div ref={menuRef} className="relative z-50">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`transition-colors ${showMenu ? 'text-white' : 'hover:text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#242f3d] rounded-lg shadow-2xl border border-[#101925] overflow-hidden z-[100]">
                <button className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#17212b]">Mute Notifications</button>
                <button className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#17212b]">Clear History</button>
                <div className="h-px w-full bg-[#101925]"></div>
                <button className="w-full text-left px-4 py-2.5 text-[14px] text-red-400 hover:bg-[#17212b]">Delete Chat</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Modal Overlay */}
      {showProfileModal && (
        <ChatProfileModal 
          chatId={chatId}
          currentUser={currentUser}
          isGroup={isGroup}
          initialName={chatName}
          initialAvatar={chatAvatar}
          otherUserId={otherUserId}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  )
}