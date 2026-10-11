'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Message, Profile } from '@/types/database'

interface ExtendedMessage extends Message {
  is_read?: boolean
  file_size?: number
}

interface MessageListProps {
  chatId: string
  currentUser: Profile
}

export default function MessageList({ chatId, currentUser }: MessageListProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ExtendedMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

      if (data) setMessages(data)
    }

    fetchMessages()

    const channel = supabase
      .channel(`chat_${chatId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
          setMessages((current) => {
            if (current.some(m => m.id === payload.new.id)) return current
            return [...current, payload.new as ExtendedMessage] // <-- Update here
          })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
          setMessages((current) => current.map(msg => msg.id === payload.new.id ? payload.new as ExtendedMessage : msg)) // <-- Update here
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [chatId, supabase])

  // FIX: Instantly mark messages as read if we are actively viewing this chat room
  useEffect(() => {
    const markUnreadAsRead = async () => {
      const unreadIds = messages
        .filter(m => m.sender_id !== currentUser.id && m.is_read === false)
        .map(m => m.id)

      if (unreadIds.length > 0) {
        // Update local state instantly so the badge clears
        setMessages(current => current.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
        
        // Update database so the sender gets the double-tick UPDATE event
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds)
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

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin scrollbar-thumb-[#242f3d] scrollbar-track-transparent">
      {messages.map((msg) => {
        const isMine = msg.sender_id === currentUser.id
        const isCall = msg.file_type?.startsWith('call/')
        const isMissed = msg.file_name === 'missed'
        const hasFile = !!msg.file_url && !isCall
        const isImage = hasFile && msg.file_type?.startsWith('image/')
        const showText = msg.content && msg.content !== msg.file_name && !isCall

        return (
          <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[75%] rounded-2xl text-[15px] shadow-sm relative overflow-hidden flex flex-col ${
                isMine 
                  ? 'bg-[#2b5278] text-white rounded-br-none' 
                  : 'bg-[#182533] text-white rounded-bl-none border border-[#101925]'
              }`}
            >
              {/* CALL HISTORY BUBBLE */}
              {isCall && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isMissed ? 'bg-red-500/20 text-red-400' : 'bg-[#5293d9]/20 text-[#5293d9]'}`}>
                    {msg.file_type === 'call/video' ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                    )}
                  </div>
                  <div className="flex flex-col pr-4">
                    <span className="font-semibold text-[14px]">{msg.content}</span>
                    <span className={`text-[12px] ${isMissed ? 'text-red-400' : 'text-[#7f91a4]'}`}>
                      {isMissed ? (isMine ? 'Canceled call' : 'Missed call') : (isMine ? 'Outgoing call' : 'Incoming call')}
                    </span>
                  </div>
                </div>
              )}

              {/* IMAGE ATTACHMENT */}
              {isImage && (
                <div className="relative group max-w-[350px]">
                  <img src={msg.file_url} alt="Attached" className="w-full h-auto max-h-[350px] object-cover" />
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg hover:bg-[#5293d9] transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </div>
                  </a>
                </div>
              )}

              {/* NON-IMAGE FILE ATTACHMENT */}
              {hasFile && !isImage && (
                <div className={`flex items-center gap-3 p-3 ${isMine ? 'bg-[#24466b]' : 'bg-[#121c26]'} m-1 rounded-xl`}>
                  <div className="w-12 h-12 bg-[#5293d9] rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="font-semibold truncate text-[14px] text-white">{msg.file_name}</span>
                    <span className="text-[12px] text-white/70">{formatBytes(msg.file_size)}</span>
                  </div>
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </a>
                </div>
              )}

              {/* TEXT CONTENT */}
              {showText && (
                <div className={`px-4 py-2 ${isImage ? 'pt-2' : ''}`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              )}

              {/* TIMESTAMP & READ RECEIPTS */}
              <div className={isImage && !showText && !isCall ? 'absolute bottom-2 right-2 px-2 py-0.5 bg-black/40 rounded-full flex items-center gap-1.5' : `px-4 pb-2 pt-1 flex justify-end items-center gap-1.5`}>
                <span className={`text-[11px] leading-none ${isImage && !showText && !isCall ? 'text-white' : isMine ? 'text-blue-200' : 'text-[#7f91a4]'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                
                {isMine && !isCall && (
                  <span className={isImage && !showText ? 'text-white' : 'text-[#5eb5f7]'}>
                    {msg.is_read ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L7 17l-5-5"></path>
                        <path d="M22 10l-7.5 7.5L13 16"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5"></path>
                      </svg>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}