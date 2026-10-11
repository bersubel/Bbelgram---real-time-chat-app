'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'

interface NewGroupModalProps {
  currentUser: Profile
  onClose: () => void
  onGroupCreated: (chatId: string) => void
}

export default function NewGroupModal({ currentUser, onClose, onGroupCreated }: NewGroupModalProps) {
  const supabase = createClient()
  const [groupName, setGroupName] = useState('')
  const [usernames, setUsernames] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) return setError('Group name is required')
    
    setIsLoading(true)
    setError('')

    try {
      // 1. Create the Chat row
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .insert([{ 
          is_group: true, 
          group_name: groupName.trim(),
          group_avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName.trim())}&background=random`
        }])
        .select('id')
        .single()

      if (chatError || !chatData) throw chatError

      // 2. Add creator as admin
      const membersToInsert = [{ chat_id: chatData.id, user_id: currentUser.id, role: 'admin' }]

      // 3. Find and add invited users
      if (usernames.trim()) {
        const namesArray = usernames.split(',').map(n => n.replace('@', '').trim()).filter(n => n)
        
        const { data: invitedUsers } = await supabase
          .from('profiles')
          .select('id, username')
          .in('username', namesArray)

        if (invitedUsers) {
          invitedUsers.forEach(u => {
            if (u.id !== currentUser.id) {
              membersToInsert.push({ chat_id: chatData.id, user_id: u.id, role: 'member' })
            }
          })
        }
      }

      const { error: membersError } = await supabase.from('chat_members').insert(membersToInsert)
      if (membersError) throw membersError

      onGroupCreated(chatData.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#17212b] w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-[#242f3d]">
        <h2 className="text-white font-semibold text-[20px] mb-6">New Group</h2>
        
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group Name"
              className="w-full bg-[#242f3d] border border-transparent focus:border-[#5293d9] rounded-xl px-4 py-3 text-white text-[15px] outline-none transition-colors"
              autoFocus
            />
          </div>

          <div>
            <textarea
              value={usernames}
              onChange={(e) => setUsernames(e.target.value)}
              placeholder="Invite users (comma separated, e.g. @john, @jane)"
              rows={3}
              className="w-full bg-[#242f3d] border border-transparent focus:border-[#5293d9] rounded-xl px-4 py-3 text-white text-[15px] outline-none transition-colors resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-[13px]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-white hover:bg-[#242f3d] rounded-lg transition-colors text-[14px]">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-5 py-2.5 bg-[#5293d9] hover:bg-[#4784c4] text-white rounded-lg transition-colors text-[14px] disabled:opacity-50 font-medium">
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}