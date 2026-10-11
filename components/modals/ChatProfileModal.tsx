'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'

interface ChatProfileModalProps {
  chatId: string
  currentUser: Profile
  isGroup: boolean
  initialName: string
  initialAvatar: string
  otherUserId: string | null
  onClose: () => void
}

export default function ChatProfileModal({ chatId, currentUser, isGroup, initialName, initialAvatar, otherUserId, onClose }: ChatProfileModalProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(initialName)
  const [avatar, setAvatar] = useState(initialAvatar)
  const [members, setMembers] = useState<any[]>([])
  
  // Individual Profile Data
  const [bio, setBio] = useState('')
  const [username, setUsername] = useState('')

  // Edit / Add Member states
  const [isEditing, setIsEditing] = useState(false)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [newMemberUsername, setNewMemberUsername] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (isGroup) {
        const { data: memberData } = await supabase
          .from('chat_members')
          .select('role, profiles (id, display_name, username, avatar_url)')
          .eq('chat_id', chatId)
        if (memberData) setMembers(memberData)
      } else if (otherUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('bio, username')
          .eq('id', otherUserId)
          .single()
        if (profile) {
          setBio(profile.bio || '')
          setUsername(profile.username || '')
        }
      }
    }
    fetchData()
  }, [chatId, isGroup, otherUserId, supabase])

  // --- Group Admin Functions ---

  const handleUpdateGroup = async () => {
    if (!name.trim()) return
    setLoading(true)
    await supabase.from('chats').update({ group_name: name }).eq('id', chatId)
    setIsEditing(false)
    setLoading(false)
  }

  const handleGroupAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return
      setLoading(true)
      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `group-${chatId}-${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      
      await supabase.from('chats').update({ group_avatar_url: publicUrl }).eq('id', chatId)
      setAvatar(publicUrl)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const cleanUsername = newMemberUsername.replace('@', '').trim()
      const { data: targetProfile } = await supabase.from('profiles').select('id').eq('username', cleanUsername).single()
      
      if (targetProfile) {
        // Check if already in group
        const exists = members.find(m => m.profiles.id === targetProfile.id)
        if (!exists) {
          await supabase.from('chat_members').insert([{ chat_id: chatId, user_id: targetProfile.id, role: 'member' }])
          // Refresh members
          const { data } = await supabase.from('chat_members').select('role, profiles (id, display_name, username, avatar_url)').eq('chat_id', chatId)
          if (data) setMembers(data)
        }
      }
      setIsAddingMember(false)
      setNewMemberUsername('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#1c242d] w-full max-w-[360px] rounded-2xl shadow-2xl border border-[#242f3d] overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header Actions */}
        <div className="flex justify-between items-center p-3 relative z-10">
          <div className="flex gap-2">
            {isGroup && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="p-2 text-[#7f91a4] hover:text-white transition-colors bg-black/20 rounded-full hover:bg-black/40">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-[#7f91a4] hover:text-white transition-colors bg-black/20 rounded-full hover:bg-black/40">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-[#242f3d] scrollbar-track-transparent">
          {/* Main Profile Info */}
          <div className="flex flex-col items-center px-6 pb-6 -mt-6">
            
            {/* Avatar */}
            <div className="relative mb-4 mt-2">
              <img src={avatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-[#242f3d]" />
              {isGroup && isEditing && (
                <>
                  <input type="file" ref={fileInputRef} accept="image/*" onChange={handleGroupAvatarUpload} className="hidden" />
                  <div onClick={() => !loading && fileInputRef.current?.click()} className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center cursor-pointer transition-opacity">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                </>
              )}
            </div>

            {/* Name */}
            {isEditing ? (
              <div className="flex items-center gap-2 w-full">
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="flex-1 bg-[#242f3d] text-white text-center rounded-lg px-3 py-1.5 border border-[#5293d9] outline-none"
                />
                <button onClick={handleUpdateGroup} className="bg-[#5293d9] text-white px-3 py-1.5 rounded-lg text-sm font-medium">Save</button>
              </div>
            ) : (
              <h2 className="text-white text-[20px] font-semibold text-center">{name}</h2>
            )}
            <p className="text-[#7f91a4] text-[14px] mt-1">{isGroup ? `${members.length} members` : 'last seen recently'}</p>

            {/* Action Buttons Row */}
            {!isEditing && (
              <div className="flex justify-center gap-4 mt-6 w-full px-4">
                <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
                  <div className="w-12 h-12 bg-[#242f3d] rounded-2xl flex items-center justify-center group-hover:bg-[#2b3847] transition-colors">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  </div>
                  <span className="text-[12px] text-[#7f91a4] group-hover:text-white transition-colors">Mute</span>
                </div>
                
                <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
                  <div className="w-12 h-12 bg-[#242f3d] rounded-2xl flex items-center justify-center group-hover:bg-[#2b3847] transition-colors">
                    {isGroup ? (
                      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    ) : (
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    )}
                  </div>
                  <span className="text-[12px] text-[#7f91a4] group-hover:text-white transition-colors">{isGroup ? 'Leave' : 'Call'}</span>
                </div>

                <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
                  <div className="w-12 h-12 bg-[#242f3d] rounded-2xl flex items-center justify-center group-hover:bg-[#2b3847] transition-colors">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                  </div>
                  <span className="text-[12px] text-[#7f91a4] group-hover:text-white transition-colors">More</span>
                </div>
              </div>
            )}
          </div>

          <div className="w-full h-2 bg-[#17212b]"></div>

          {/* Section: Individual User Details */}
          {!isGroup && (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-white text-[15px]">@{username}</p>
                <p className="text-[#7f91a4] text-[13px]">Username</p>
              </div>
              {bio && (
                <div>
                  <p className="text-white text-[15px]">{bio}</p>
                  <p className="text-[#7f91a4] text-[13px]">Bio</p>
                </div>
              )}
            </div>
          )}

          {/* Section: Group Members */}
          {isGroup && (
            <div>
              <div className="px-4 py-3 flex justify-between items-center border-b border-[#242f3d]">
                <span className="text-[#7f91a4] text-[13px] font-semibold tracking-wide uppercase">{members.length} Members</span>
                
                {/* Add Member Button / Input */}
                {!isAddingMember ? (
                  <button onClick={() => setIsAddingMember(true)} className="text-[#5293d9] text-[14px] font-medium hover:underline">
                    Add Member
                  </button>
                ) : (
                  <form onSubmit={handleAddMember} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="@username" 
                      value={newMemberUsername}
                      onChange={e => setNewMemberUsername(e.target.value)}
                      className="w-24 bg-[#17212b] border border-[#242f3d] text-white text-xs px-2 py-1 rounded outline-none" 
                      autoFocus
                    />
                    <button type="submit" className="text-[#5293d9] text-xs font-semibold">Add</button>
                  </form>
                )}
              </div>

              <div className="pb-4">
                {members.map(m => {
                  const p = m.profiles
                  const profileData = Array.isArray(p) ? p[0] : p
                  const mName = profileData?.display_name || 'User'
                  const mAvatar = profileData?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(mName)}&background=random`
                  
                  return (
                    <div key={profileData?.id} className="flex items-center gap-3 px-4 py-2 hover:bg-[#242f3d] transition-colors cursor-pointer">
                      <img src={mAvatar} alt={mName} className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <h4 className="text-white text-[14px] font-medium truncate">{mName}</h4>
                          {m.role === 'admin' && <span className="text-[#7f91a4] text-[12px]">admin</span>}
                        </div>
                        <p className="text-[#7f91a4] text-[13px] truncate">@{profileData?.username || 'user'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}