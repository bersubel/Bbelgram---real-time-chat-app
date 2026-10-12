'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Message, Profile } from '@/types/database'

export interface ExtendedMessage extends Message {
  is_read?: boolean
  file_size?: number
  reply_to_id?: string | null
  reactions?: Record<string, number>
  profiles?: { display_name: string } | null
}

interface MessageListProps {
  chatId: string
  currentUser: Profile
  onReply: (msg: ExtendedMessage) => void
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '🔥', '🎉', '😢']

export default function MessageList({ chatId, currentUser, onReply }: MessageListProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ExtendedMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  
  // State to track which message's reaction menu is actively open on mobile
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null)

  // Close the reaction menu if the user taps anywhere else on the screen
  useEffect(() => {
    const handleOutsideClick = () => setActiveReactionId(null)
    document.addEventListener('pointerdown', handleOutsideClick)
    return () => document.removeEventListener('pointerdown', handleOutsideClick)
  }, [])

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(display_name)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

      if (data) setMessages(data as ExtendedMessage[])
    }

    fetchMessages()

    const channel = supabase
      .channel(`chat_${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, async (payload) => {
          const { data: profileData } = await supabase.from('profiles').select('display_name').eq('id', payload.new.sender_id).single()
          const newMessage = { ...payload.new, profiles: profileData } as ExtendedMessage
          
          setMessages((current) => {
            if (current.some(m => m.id === newMessage.id)) return current
            return [...current, newMessage]
          })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
          setMessages((current) => current.map(msg => msg.id === payload.new.id ? { ...msg, ...payload.new } as ExtendedMessage : msg))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [chatId, supabase])

  useEffect(() => {
    const markUnreadAsRead = async () => {
      const unreadIds = messages
        .filter(m => m.sender_id !== currentUser.id && m.is_read === false)
        .map(m => m.id)

      if (unreadIds.length > 0) {
        setMessages(current => current.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
        await supabase.from('messages').update({ is_read: true }).in('id', unreadIds)
      }
    }
    markUnreadAsRead()
  }, [messages, currentUser.id, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleReaction = async (msg: ExtendedMessage, emoji: string) => {
    const currentReactions = msg.reactions || {}
    const newReactions = { ...currentReactions, [emoji]: (currentReactions[emoji] || 0) + 1 }
    setMessages(current => current.map(m => m.id === msg.id ? { ...m, reactions: newReactions } : m))
    await supabase.from('messages').update({ reactions: newReactions }).eq('id', msg.id)
  }

  const getRepliedMessage = (replyId?: string | null) => {
    if (!replyId) return null
    return messages.find(m => m.id === replyId)
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 scrollbar-thin scrollbar-thumb-[#242f3d] scrollbar-track-transparent">
      {messages.map((msg) => {
        const isMine = msg.sender_id === currentUser.id
        const isCall = msg.file_type?.startsWith('call/')
        const isMissed = msg.file_name === 'missed'
        const hasFile = !!msg.file_url && !isCall
        const isImage = hasFile && msg.file_type?.startsWith('image/')
        const showText = msg.content && msg.content !== msg.file_name && !isCall
        
        const repliedMsg = getRepliedMessage(msg.reply_to_id)
        const isReactionOpen = activeReactionId === msg.id

        return (
          <div key={msg.id} className={`flex group ${isMine ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-center gap-1 sm:gap-2 max-w-[90%] sm:max-w-[85%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              
              <div 
                className={`rounded-2xl text-[14px] sm:text-[15px] shadow-sm relative overflow-hidden flex flex-col ${
                  isMine ? 'bg-[#2b5278] text-white rounded-br-none' : 'bg-[#182533] text-white rounded-bl-none border border-[#101925]'
                }`}
              >
                {/* REPLIED MESSAGE PREVIEW */}
                {repliedMsg && (
                  <div 
                    onClick={() => document.getElementById(`msg-${repliedMsg.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                    className="mx-2 mt-2 pl-2.5 py-1 text-[12px] sm:text-[13px] border-l-[3px] border-[#5eb5f7] bg-black/10 rounded-r-md cursor-pointer hover:bg-black/20 transition-colors"
                  >
                    <div className="font-semibold text-[#5eb5f7] mb-0.5">
                      {repliedMsg.sender_id === currentUser.id ? 'You' : (repliedMsg.profiles?.display_name || 'User')}
                    </div>
                    <div className="truncate text-white/70 max-w-[150px] sm:max-w-[200px]">
                      {repliedMsg.content || 'Attachment'}
                    </div>
                  </div>
                )}

                {/* CALL HISTORY BUBBLE */}
                {isCall && (
                  <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${isMissed ? 'bg-red-500/20 text-red-400' : 'bg-[#5293d9]/20 text-[#5293d9]'}`}>
                      {msg.file_type === 'call/video' ? (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                      ) : (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                      )}
                    </div>
                    <div className="flex flex-col pr-2 sm:pr-4">
                      <span className="font-semibold text-[13px] sm:text-[14px]">{msg.content}</span>
                      <span className={`text-[11px] sm:text-[12px] ${isMissed ? 'text-red-400' : 'text-[#7f91a4]'}`}>
                        {isMissed ? (isMine ? 'Canceled' : 'Missed') : (isMine ? 'Outgoing' : 'Incoming')}
                      </span>
                    </div>
                  </div>
                )}

                {/* IMAGE ATTACHMENT */}
                {isImage && (
                  <div className="relative max-w-[250px] sm:max-w-[350px]">
                    <img src={msg.file_url} alt="Attached" className="w-full h-auto max-h-[250px] sm:max-h-[350px] object-cover" />
                  </div>
                )}

                {/* NON-IMAGE FILE ATTACHMENT */}
                {hasFile && !isImage && (
                  <div className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 ${isMine ? 'bg-[#24466b]' : 'bg-[#121c26]'} m-1 rounded-xl`}>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#5293d9] rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="font-semibold truncate text-[13px] sm:text-[14px] text-white">{msg.file_name}</span>
                      <span className="text-[11px] sm:text-[12px] text-white/70">{formatBytes(msg.file_size)}</span>
                    </div>
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </a>
                  </div>
                )}

                {/* TEXT CONTENT */}
                {showText && (
                  <div className={`px-3 sm:px-4 py-1.5 sm:py-2 ${isImage || repliedMsg ? 'pt-1' : ''}`}>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                )}

                {/* EMOJI REACTIONS (Existing ones on the bubble) */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 px-2 pb-1.5 pt-0.5 sm:gap-1.5 sm:px-3 sm:pb-2 sm:pt-1">
                    {Object.entries(msg.reactions).map(([emoji, count]) => (
                      <button 
                        key={emoji} 
                        onClick={() => handleReaction(msg, emoji)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2 rounded-full text-[11px] sm:text-[12px] border ${
                          isMine ? 'bg-[#1c3a57] border-[#24466b] hover:bg-[#24466b]' : 'bg-[#242f3d] border-[#101925] hover:bg-[#2c3947]'
                        } transition-colors`}
                      >
                        <span>{emoji}</span>
                        <span className="text-white/80 font-medium">{count as number}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* TIMESTAMP & READ RECEIPTS */}
                <div className={isImage && !showText && !isCall && (!msg.reactions || Object.keys(msg.reactions).length === 0) ? 'absolute bottom-2 right-2 px-2 py-0.5 bg-black/40 rounded-full flex items-center gap-1' : `px-3 pb-1.5 sm:px-4 sm:pb-2 flex justify-end items-center gap-1`}>
                  <span className={`text-[10px] sm:text-[11px] leading-none ${isImage && !showText && !isCall && (!msg.reactions || Object.keys(msg.reactions).length === 0) ? 'text-white' : isMine ? 'text-blue-200' : 'text-[#7f91a4]'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  
                  {isMine && !isCall && (
                    <span className={isImage && !showText && (!msg.reactions || Object.keys(msg.reactions).length === 0) ? 'text-white' : 'text-[#5eb5f7]'}>
                      {msg.is_read ? (
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-7.5 7.5L13 16"></path></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* HOVER ACTIONS (REPLY & REACT) */}
              {!isCall && (
                <div className={`transition-opacity flex items-center gap-0.5 sm:gap-1 text-[#7f91a4] shrink-0 ${isReactionOpen ? 'opacity-100' : 'opacity-100 lg:opacity-0 group-hover:opacity-100'}`}>
                  <button onClick={() => onReply(msg)} className="p-1 sm:p-1.5 hover:bg-[#17212b] rounded-full hover:text-white transition-colors" title="Reply">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                  </button>
                  
                  <div className="relative group/emoji">
                    <button 
                      // 1. Snappy trigger on mobile touch
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setActiveReactionId(activeReactionId === msg.id ? null : msg.id)
                      }}
                      // 2. Desktop fallback
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (activeReactionId !== msg.id) setActiveReactionId(msg.id)
                      }}
                      className="p-1 sm:p-1.5 hover:bg-[#17212b] rounded-full hover:text-white transition-colors focus:text-white focus:bg-[#17212b]" 
                      title="React"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    
                    <div 
                      onPointerDown={(e) => e.stopPropagation()} 
                      className={`absolute bottom-full right-0 lg:left-1/2 lg:-translate-x-1/2 pb-2 z-50 ${isReactionOpen ? 'flex' : 'hidden lg:group-hover/emoji:flex'}`}
                    >
                      <div className="bg-[#242f3d] px-2 py-1.5 rounded-full shadow-lg border border-[#101925] flex gap-1">
                        {QUICK_EMOJIS.map(emoji => (
                          <button 
                            key={emoji} 
                            // 3. Bulletproof instantaneous mobile execution
                            onPointerDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleReaction(msg, emoji)
                              setActiveReactionId(null)
                            }}
                            // Desktop fallback
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleReaction(msg, emoji)
                              setActiveReactionId(null)
                            }} 
                            className="hover:scale-125 hover:bg-white/10 p-1.5 sm:p-1 rounded-full transition-all text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )
      })}
      <div id="bottom-ref" ref={bottomRef} />
    </div>
  )
}