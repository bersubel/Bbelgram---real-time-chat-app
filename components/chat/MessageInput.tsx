'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'
import { ExtendedMessage } from './MessageList'

interface MessageInputProps {
  chatId: string
  currentUser: Profile
  onMessageSent: () => void
  replyingTo: ExtendedMessage | null      // <-- New Prop
  onCancelReply: () => void               // <-- New Prop
}

const EMOJIS = ['😀', '😂', '🥰', '😎', '🤔', '😢', '😡', '👍', '🙏', '🔥', '❤️', '🎉', '✨', '💯', '🙌', '👀']

export default function MessageInput({ chatId, currentUser, onMessageSent, replyingTo, onCancelReply }: MessageInputProps) {
  const supabase = createClient()
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    channelRef.current = supabase.channel(`presence_${chatId}`).subscribe()
    return () => { supabase.removeChannel(channelRef.current) }
  }, [chatId, supabase])

  // Auto-focus input when hitting reply
  useEffect(() => {
    if (replyingTo) inputRef.current?.focus()
  }, [replyingTo])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) setShowEmojis(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value)

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast', event: 'typing',
        payload: { isTyping: true, userId: currentUser.id, username: (currentUser as any).display_name || currentUser.username }
      })
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast', event: 'typing',
          payload: { isTyping: false, userId: currentUser.id }
        })
      }
    }, 2000)
  }

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isSubmitting) return

    setIsSubmitting(true)
    const textToSend = message.trim()
    setMessage('') 

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast', event: 'typing', payload: { isTyping: false, userId: currentUser.id }
      })
    }

    // Include the reply_to_id here!
    await supabase.from('messages').insert([{
      chat_id: chatId, 
      sender_id: currentUser.id, 
      content: textToSend, 
      is_read: false,
      reply_to_id: replyingTo?.id || null 
    }])

    setIsSubmitting(false)
    setShowEmojis(false)
    onCancelReply() // Clear the reply preview bar
    onMessageSent()
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return
      setIsSubmitting(true)

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `chat-${chatId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('chat_files').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('chat_files').getPublicUrl(filePath)

      await supabase.from('messages').insert([{
        chat_id: chatId, sender_id: currentUser.id, content: file.name,
        file_url: publicUrl, file_type: file.type, file_name: file.name, file_size: file.size, is_read: false,
        reply_to_id: replyingTo?.id || null
      }])

      onCancelReply()
      onMessageSent()
    } catch (err) {
      console.error("Upload error:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const insertEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji)
  }

  return (
    <div className="px-4 pb-4 pt-1 bg-transparent shrink-0 relative flex flex-col items-center">
      
      {/* REPLY PREVIEW BAR */}
      {replyingTo && (
        <div className="w-full max-w-4xl mx-auto mb-2 bg-[#17212b] rounded-t-xl px-4 py-2 border-l-4 border-[#5eb5f7] flex items-center justify-between shadow-md">
          <div className="flex flex-col overflow-hidden">
            <span className="text-[#5eb5f7] text-[13px] font-semibold">
              Replying to {replyingTo.sender_id === currentUser.id ? 'yourself' : (replyingTo.profiles?.display_name || 'User')}
            </span>
            <span className="text-white/70 text-[14px] truncate">
              {replyingTo.content || replyingTo.file_name || 'Attachment'}
            </span>
          </div>
          <button onClick={onCancelReply} className="text-[#7f91a4] hover:text-white p-2 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSendText} className="flex items-center gap-2 w-full max-w-4xl mx-auto">
        <div className="relative shrink-0">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting} className="w-12 h-12 flex items-center justify-center text-[#7f91a4] hover:text-white bg-[#17212b] rounded-full hover:bg-[#242f3d] transition-colors disabled:opacity-50">
            <svg className="w-6 h-6 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
        </div>

        <div className={`flex-1 flex items-center bg-[#17212b] border border-transparent focus-within:border-[#5293d9] transition-colors shadow-sm relative pr-2 ${replyingTo ? 'rounded-b-2xl rounded-tr-2xl' : 'rounded-2xl'}`}>
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleTextChange}
            placeholder="Write a message..."
            className="flex-1 bg-transparent text-white placeholder-[#7f91a4] text-[15px] px-5 py-3.5 outline-none"
            autoFocus
          />
          
          <div ref={emojiRef} className="relative">
            <button type="button" onClick={() => setShowEmojis(!showEmojis)} className="p-2 text-[#7f91a4] hover:text-[#5293d9] transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {showEmojis && (
              <div className="absolute bottom-[50px] right-0 bg-[#242f3d] border border-[#101925] rounded-xl shadow-2xl p-3 w-[260px] z-50">
                <div className="grid grid-cols-4 gap-2">
                  {EMOJIS.map(emoji => (
                    <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="text-2xl hover:bg-[#17212b] p-2 rounded-lg transition-colors flex items-center justify-center">
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <button type={message.trim() ? "submit" : "button"} disabled={isSubmitting} className={`w-12 h-12 flex items-center justify-center rounded-full shrink-0 transition-all ${message.trim() ? 'bg-[#5293d9] text-white hover:bg-[#4784c4] hover:scale-105 shadow-md' : 'bg-[#17212b] text-[#7f91a4] hover:bg-[#242f3d] hover:text-white'}`}>
          {message.trim() ? (
            <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          )}
        </button>
      </form>
    </div>
  )
}