'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'

interface CreateGroupModalProps {
  currentUser: Profile
  onClose: () => void
  onSuccess: (newChatId: string) => void
}

export default function CreateGroupModal({ currentUser, onClose, onSuccess }: CreateGroupModalProps) {
  const supabase = createClient()
  const [groupName, setGroupName] = useState('')
  const [usernames, setUsernames] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!groupName.trim()) {
      setError("Group name is required.")
      setLoading(false)
      return
    }

    // Split and clean the usernames input
    const cleanUsernames = usernames
      .split(',')
      .map(u => u.replace('@', '').trim())
      .filter(u => u.length > 0 && u !== currentUser.username)

    if (cleanUsernames.length === 0) {
      setError("Please add at least one other user.")
      setLoading(false)
      return
    }

    // 1. Fetch profiles for all valid usernames
    const { data: targetUsers, error: searchError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('username', cleanUsernames)

    if (searchError || !targetUsers || targetUsers.length === 0) {
      setError("No valid users found. Check the usernames.")
      setLoading(false)
      return
    }

    // 2. Create the Group Chat record
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .insert([{ 
        is_group: true, 
        group_name: groupName.trim(),
        created_by: currentUser.id
      }])
      .select('id')
      .single()

    if (chatError || !chatData) {
      setError("Failed to create group.")
      setLoading(false)
      return
    }

    // 3. Build the membership payload (creator + invited users)
    const membersPayload = [
      { chat_id: chatData.id, user_id: currentUser.id, role: 'admin' },
      ...targetUsers.map(user => ({ chat_id: chatData.id, user_id: user.id, role: 'member' }))
    ]

    // 4. Insert all members
    const { error: membersError } = await supabase
      .from('chat_members')
      .insert(membersPayload)

    if (membersError) {
      setError("Failed to add members to the group.")
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess(chatData.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#17212b] w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-[#242f3d]">
        <h2 className="text-[18px] font-semibold mb-4 text-white">New Group</h2>
        <form onSubmit={handleSubmit}>
          
          <div className="mb-4">
            <label className="block text-[13px] text-[#7f91a4] mb-2 font-medium">Group Name</label>
            <div className="flex items-center bg-[#242f3d] rounded-xl px-3 py-2 border border-transparent focus-within:border-[#5293d9] transition-colors">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Portfolio Project Team"
                className="flex-1 bg-transparent border-none text-white outline-none text-[15px]"
                autoFocus
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] text-[#7f91a4] mb-2 font-medium">Add Members (comma separated)</label>
            <div className="flex items-center bg-[#242f3d] rounded-xl px-3 py-2 border border-transparent focus-within:border-[#5293d9] transition-colors">
              <span className="text-[#7f91a4] mr-1">@</span>
              <input
                type="text"
                value={usernames}
                onChange={(e) => setUsernames(e.target.value)}
                placeholder="user1, user2"
                className="flex-1 bg-transparent border-none text-white outline-none text-[15px]"
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
              disabled={loading || !groupName.trim() || !usernames.trim()}
              className="px-4 py-2 bg-[#5293d9] hover:bg-[#4784c4] rounded-lg text-white transition-colors text-[14px] font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}