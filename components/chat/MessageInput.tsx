'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'

interface MessageInputProps {
  chatId: string
  currentUser: Profile
  onMessageSent: () => void
}

const EMOJIS = ['😀', '😂', '🥰', '😎', '🤔', '😢', '😡', '👍', '🙏', '🔥', '❤️', '🎉', '✨', '💯', '🙌', '👀']

export default function MessageInput({ chatId, currentUser, onMessageSent }: MessageInputProps) {
  const supabase = createClient()
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmojis(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isSubmitting) return

    setIsSubmitting(true)
    const textToSend = message.trim()
    setMessage('') // Clear input instantly for UI speed

    await supabase.from('messages').insert([{
      chat_id: chatId,
      sender_id: currentUser.id,
      content: textToSend,
      is_read: false // Defaults to unread
    }])

    setIsSubmitting(false)
    setShowEmojis(false)
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
        chat_id: chatId,
        sender_id: currentUser.id,
        content: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_name: file.name,
        file_size: file.size,
        is_read: false
      }])

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
    <div className="p-4 bg-transparent shrink-0 relative">
      <form onSubmit={handleSendText} className="flex items-center gap-2 max-w-4xl mx-auto">
        
        {/* Attachment Button */}
        <div className="relative shrink-0">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className="w-12 h-12 flex items-center justify-center text-[#7f91a4] hover:text-white bg-[#17212b] rounded-full hover:bg-[#242f3d] transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
        </div>

        {/* Input Field & Emoji Picker */}
        <div className="flex-1 flex items-center bg-[#17212b] rounded-2xl border border-transparent focus-within:border-[#5293d9] transition-colors shadow-sm relative pr-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a message..."
            className="flex-1 bg-transparent text-white placeholder-[#7f91a4] text-[15px] px-5 py-3.5 outline-none"
            autoFocus
          />
          
          <div ref={emojiRef} className="relative">
            <button 
              type="button" 
              onClick={() => setShowEmojis(!showEmojis)}
              className="p-2 text-[#7f91a4] hover:text-[#5293d9] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Emoji Popover */}
            {showEmojis && (
              <div className="absolute bottom-[50px] right-0 bg-[#242f3d] border border-[#101925] rounded-xl shadow-2xl p-3 w-[260px] z-50">
                <div className="grid grid-cols-4 gap-2">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-2xl hover:bg-[#17212b] p-2 rounded-lg transition-colors flex items-center justify-center"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Send / Mic Button */}
        <button 
          type={message.trim() ? "submit" : "button"}
          disabled={isSubmitting}
          className={`w-12 h-12 flex items-center justify-center rounded-full shrink-0 transition-all ${
            message.trim() 
              ? 'bg-[#5293d9] text-white hover:bg-[#4784c4] hover:scale-105 shadow-md' 
              : 'bg-[#17212b] text-[#7f91a4] hover:bg-[#242f3d] hover:text-white'
          }`}
        >
          {message.trim() ? (
            <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}