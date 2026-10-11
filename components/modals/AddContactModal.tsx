'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'

interface AddContactModalProps {
  currentUser: Profile
  onClose: () => void
  onSuccess: (newChatId: string) => void
}

export default function AddContactModal({ currentUser, onClose, onSuccess }: AddContactModalProps) {
  const supabase = createClient()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanUsername = username.replace('@', '').trim()

    if (cleanUsername === currentUser.username) {
      setError("You cannot start a chat with yourself.")
      setLoading(false)
      return
    }

    // 1. Locate the target user
    const { data: targetUser, error: searchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .single()

    if (searchError || !targetUser) {
      setError("User not found. Check the username.")
      setLoading(false)
      return
    }

    // 2. Create the base chat record (Added created_by to satisfy potential DB constraints)
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .insert([{ 
        is_group: false,
        created_by: currentUser.id 
      }])
      .select('id')
      .single()

    if (chatError || !chatData) {
      console.error("Chat Error:", chatError)
      // This will now show the EXACT reason Supabase rejected it on your screen
      setError(`Chat Error: ${chatError?.message || "Failed to create chat."}`)
      setLoading(false)
      return
    }

    // 3. Bind both users to the new chat
    const { error: membersError } = await supabase
      .from('chat_members')
      .insert([
        { chat_id: chatData.id, user_id: currentUser.id, role: 'admin' },
        { chat_id: chatData.id, user_id: targetUser.id, role: 'member' }
      ])

    if (membersError) {
      console.error("Members Error:", membersError)
      setError(`Members Error: ${membersError.message || "Failed to link users."}`)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess(chatData.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#17212b] w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-[#242f3d]">
        <h2 className="text-[18px] font-semibold mb-4 text-white">New Message</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[13px] text-[#7f91a4] mb-2 font-medium">Search by exact username</label>
            <div className="flex items-center bg-[#242f3d] rounded-xl px-3 py-2 border border-transparent focus-within:border-[#5293d9] transition-colors">
              <span className="text-[#7f91a4] mr-1">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="flex-1 bg-transparent border-none text-white outline-none text-[15px]"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-[13px] mt-2">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-white hover:bg-[#242f3d] transition-colors text-[14px] font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="px-4 py-2 bg-[#5293d9] hover:bg-[#4784c4] rounded-lg text-white transition-colors text-[14px] font-medium disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Start Chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}