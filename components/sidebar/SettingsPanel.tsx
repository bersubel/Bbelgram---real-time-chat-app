'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'

interface SettingsPanelProps {
  currentUser: Profile
  onClose: () => void
  onProfileUpdated: (updatedProfile: Profile) => void
}

export default function SettingsPanel({ currentUser, onClose, onProfileUpdated }: SettingsPanelProps) {
  const supabase = createClient()
  
  const [displayName, setDisplayName] = useState(currentUser.display_name || '')
  const [username, setUsername] = useState(currentUser.username || '')
  const [bio, setBio] = useState((currentUser as any).bio || '') 
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle Profile Info Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage('')

    const cleanUsername = username.replace('@', '').trim()

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id)

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Profile updated successfully!')
      onProfileUpdated({ ...currentUser, display_name: displayName, username: cleanUsername, bio } as any)
    }
    setIsSaving(false)
  }

  // Handle Avatar Image Upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setMessage('')
      if (!event.target.files || event.target.files.length === 0) return
      
      setIsUploading(true)
      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `${currentUser.id}-${Math.random()}.${fileExt}`

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // 3. Update Profile Record
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id)

      if (updateError) throw updateError

      onProfileUpdated({ ...currentUser, avatar_url: publicUrl })
      setMessage('Avatar updated successfully!')
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#17212b] w-full absolute inset-0 z-30">
      
      {/* Header */}
      <div className="h-[60px] flex items-center gap-4 px-4 border-b border-[#101925] bg-[#17212b] shrink-0">
        <button onClick={onClose} className="p-2 text-[#7f91a4] hover:text-white transition-colors rounded-full hover:bg-[#242f3d]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h2 className="text-white font-semibold text-[16px]">Settings</h2>
      </div>

      {/* Profile Scroll Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#242f3d] scrollbar-track-transparent pb-6">
        
        {/* Avatar Section */}
        <div className="flex flex-col items-center py-8 bg-[#1c2733] border-b border-[#101925]">
          
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            onChange={handleAvatarUpload} 
            className="hidden" 
          />
          
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`relative group cursor-pointer mb-4 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <img 
              src={currentUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.display_name || 'U')}&background=random`} 
              alt="Avatar" 
              className="w-28 h-28 rounded-full object-cover border-2 border-[#242f3d]"
            />
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <h3 className="text-white font-medium text-[20px]">{displayName || 'Unknown User'}</h3>
          <p className="text-[#7f91a4] text-[14px]">@{username || 'username'}</p>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="p-4 space-y-5 mt-2">
          
          <div>
            <label className="text-[#5293d9] text-[13px] font-medium ml-1 block mb-1">Display Name</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#242f3d] border border-transparent focus:border-[#5293d9] rounded-xl px-4 py-3 text-white text-[15px] outline-none transition-colors"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="text-[#5293d9] text-[13px] font-medium ml-1 block mb-1">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7f91a4]">@</span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                className="w-full bg-[#242f3d] border border-transparent focus:border-[#5293d9] rounded-xl pl-8 pr-4 py-3 text-white text-[15px] outline-none transition-colors"
                placeholder="username"
              />
            </div>
            <p className="text-[#7f91a4] text-[12px] mt-1.5 ml-1 leading-relaxed">
              You can choose a username on Mini Telegram. If you do, people will be able to find you by this username and contact you without knowing your phone number.
            </p>
          </div>

          <div>
            <label className="text-[#5293d9] text-[13px] font-medium ml-1 block mb-1">Bio</label>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-[#242f3d] border border-transparent focus:border-[#5293d9] rounded-xl px-4 py-3 text-white text-[15px] outline-none transition-colors resize-none"
              placeholder="A few words about you"
            />
            <p className="text-[#7f91a4] text-[12px] mt-1.5 ml-1 leading-relaxed">
              Any details such as age, occupation or city.
            </p>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${message.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
              {message}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full bg-[#5293d9] hover:bg-[#4784c4] text-white rounded-xl py-3 font-medium transition-colors disabled:opacity-50 mt-4"
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

      </div>
    </div>
  )
}