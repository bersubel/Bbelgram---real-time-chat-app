'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Profile, ChatTab } from '@/types/database'

import FolderSidebar from '@/components/sidebar/FolderSidebar'
import HamburgerMenu from '@/components/modals/HamburgerMenu'
import ChatList from '@/components/sidebar/ChatList'
import ChatHeader from '@/components/chat/ChatHeader'
import MessageList from '@/components/chat/MessageList'
import MessageInput from '@/components/chat/MessageInput'
import CallModal from '@/components/modals/CallModal'
import SettingsPanel from '@/components/sidebar/SettingsPanel'
import NewGroupModal from '@/components/modals/NewGroupModal'

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [activeTab, setActiveTab] = useState<ChatTab>('personal')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // New state for logout transition
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [showSettings, setShowSettings] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)

  const [activeCall, setActiveCall] = useState<{
    type: 'voice' | 'video'
    name: string
    avatar: string
    chatId: string
    incomingCallId?: string
  } | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (profile) setCurrentUser(profile)
      setLoading(false)
    }
    fetchUser()
  }, [router, supabase])

  useEffect(() => {
    if (!currentUser) return

    const channel = supabase.channel('global_incoming_calls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, async (payload) => {
        const newCall = payload.new
        if (newCall.caller_id !== currentUser.id && newCall.status === 'ongoing') {
          const { data: member } = await supabase.from('chat_members').select('chat_id').eq('chat_id', newCall.chat_id).eq('user_id', currentUser.id).single()
          if (!member) return

          const { data: caller } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', newCall.caller_id).single()
          
          if (caller) {
            setActiveCall({
              type: newCall.call_type as 'voice' | 'video',
              name: caller.display_name,
              avatar: caller.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(caller.display_name)}&background=random`,
              chatId: newCall.chat_id,
              incomingCallId: newCall.id
            })
          }
        }
      }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUser, supabase])

  const handleLogout = async () => {
    // 1. Close menus and start transition animation
    setIsMenuOpen(false)
    setIsTransitioning(true)
    
    // 2. Wait 1.5 seconds for animation, then actually sign out and redirect
    setTimeout(async () => {
      await supabase.auth.signOut()
      window.location.href = '/' // Hard redirect clears all caches and WebSockets
    }, 1500)
  }

  const handleStartCall = (type: 'voice' | 'video', name: string, avatar: string) => {
    if (activeChatId) {
      setActiveCall({ type, name, avatar, chatId: activeChatId })
    }
  }

  if (loading) return (
    <div className="h-screen w-full bg-[#0e1621] flex items-center justify-center text-[#7f91a4]">
      Loading your Bbelgram Chat-Room...
    </div>
  )

  return (
    <div className="flex h-screen w-full bg-[#0e1621] text-white font-sans overflow-hidden relative">
      
      {/* LOGOUT SPLASH SCREEN TRANSITION */}
      {isTransitioning && (
        <div className="absolute inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0e1621] transition-opacity duration-500">
          <div className="relative h-28 w-28 animate-bounce">
            <div className="absolute inset-0 rounded-full bg-[#5293d9] blur-xl opacity-40 animate-pulse"></div>
            <img 
              src="/Bbelgram-logo.png" 
              alt="Bbelgram Logo" 
              className="relative h-full w-full object-cover rounded-full shadow-2xl"
              onError={(e) => { (e.target as HTMLImageElement).src = '/Bbelgram-logo.jpg' }}
            />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-widest text-white animate-pulse">
            Logging out...
          </h1>
        </div>
      )}
      
      <FolderSidebar activeTab={activeTab} setActiveTab={setActiveTab} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      
      {isMenuOpen && currentUser && (
        <HamburgerMenu 
          currentUser={currentUser} 
          setIsMenuOpen={setIsMenuOpen} 
          handleLogout={handleLogout} 
          onOpenSettings={() => {
            setShowSettings(true)
            setIsMenuOpen(false) 
          }}
          onOpenNewGroup={() => {
            setShowNewGroup(true)
            setIsMenuOpen(false)
          }}
        />
      )}

      {/* Render New Group Modal if active */}
      {showNewGroup && currentUser && (
        <NewGroupModal 
          currentUser={currentUser} 
          onClose={() => setShowNewGroup(false)} 
          onGroupCreated={(newChatId) => {
            setShowNewGroup(false)
            setActiveChatId(newChatId)
            setActiveTab('groups')
          }} 
        />
      )}

      <div className="w-[320px] bg-[#17212b] border-r border-[#101925] flex flex-col shrink-0 relative z-10 overflow-hidden">
        {showSettings && currentUser ? (
          <SettingsPanel 
            currentUser={currentUser} 
            onClose={() => setShowSettings(false)} 
            onProfileUpdated={(updated) => setCurrentUser(updated)}
          />
        ) : (
          currentUser && (
            <ChatList 
              currentUser={currentUser} 
              activeTab={activeTab} 
              activeChatId={activeChatId} 
              setActiveChatId={setActiveChatId} 
            />
          )
        )}
      </div>

      <div className="flex-1 flex flex-col bg-[#0e1621] relative z-0">
        {activeChatId && currentUser ? (
          <div className="flex-1 flex flex-col h-full bg-[url('https://telegram.org/file/464001088/1/5bU4AGF6_0w.166164/5ff00609b53299cff3')] bg-cover bg-center bg-fixed bg-no-repeat bg-[#0e1621] bg-blend-overlay">
            
            <ChatHeader chatId={activeChatId} currentUser={currentUser} onStartCall={handleStartCall} />
            <MessageList key={`${activeChatId}-${refreshKey}`} chatId={activeChatId} currentUser={currentUser} />
            <MessageInput chatId={activeChatId} currentUser={currentUser} onMessageSent={() => setRefreshKey(prev => prev + 1)} />
            
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[url('https://telegram.org/file/464001088/1/5bU4AGF6_0w.166164/5ff00609b53299cff3')] bg-cover bg-center bg-fixed bg-no-repeat bg-[#0e1621] bg-blend-overlay">
            <div className="bg-[#17212b]/80 px-4 py-1.5 rounded-full text-sm text-white backdrop-blur-sm">
              Select a chat to start messaging
            </div>
          </div>
        )}
      </div>

      {activeCall && currentUser && (
        <CallModal 
          chatId={activeCall.chatId}
          currentUser={currentUser}
          callType={activeCall.type}
          chatName={activeCall.name}
          chatAvatar={activeCall.avatar}
          incomingCallId={activeCall.incomingCallId}
          onClose={() => setActiveCall(null)}
        />
      )}

    </div>
  )
}