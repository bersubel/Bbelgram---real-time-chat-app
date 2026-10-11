'use client'

import { useState, useEffect } from 'react'
import { Profile } from '@/types/database'

interface HamburgerMenuProps {
  currentUser: Profile
  setIsMenuOpen: (isOpen: boolean) => void
  handleLogout: () => void
  onOpenSettings: () => void
  onOpenNewGroup: () => void
}

export default function HamburgerMenu({ currentUser, setIsMenuOpen, handleLogout, onOpenSettings, onOpenNewGroup }: HamburgerMenuProps) {
  const [isNightMode, setIsNightMode] = useState(true)
  
  // Initialize theme from localStorage on load
  useEffect(() => {
    const theme = localStorage.getItem('theme')
    if (theme === 'light') {
      setIsNightMode(false)
      document.documentElement.classList.remove('dark')
    } else {
      setIsNightMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isNightMode
    setIsNightMode(newMode)
    if (newMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }
  
  const avatarUrl = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.display_name}&background=random`

  return (
    <>
      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsMenuOpen(false)} />
      
      <div className="absolute left-[80px] top-0 bottom-0 w-[300px] bg-[#17212b] shadow-2xl z-50 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-[#242f3d] border-r border-[#101925]">
        
        <div className="p-4 bg-[#1c242d] relative group">
          <img src={avatarUrl} alt="Avatar" className="w-14 h-14 rounded-full mb-3 object-cover cursor-pointer hover:brightness-110 transition-all" />
          <div className="flex items-center gap-1">
            <h3 className="font-semibold text-[15px] text-white">{currentUser.display_name}</h3>
          </div>
          <p className="text-[13px] text-[#5293d9] cursor-pointer hover:underline mt-0.5">@{currentUser.username}</p>
        </div>

        <div className="w-full h-[1px] bg-[#101925] my-1" />

        <div className="py-1 flex-1">
          <button onClick={onOpenSettings} className="w-full text-left px-5 py-2.5 hover:bg-[#202b36] transition-colors flex items-center gap-5 text-[14px] font-medium text-white group">
            <svg className="w-[22px] h-[22px] text-[#7f91a4] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          
          <button onClick={onOpenNewGroup} className="w-full text-left px-5 py-2.5 hover:bg-[#202b36] transition-colors flex items-center gap-5 text-[14px] font-medium text-white group">
            <svg className="w-[22px] h-[22px] text-[#7f91a4] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            New Group
          </button>
          
          <button onClick={handleLogout} className="w-full text-left px-5 py-2.5 hover:bg-[#202b36] transition-colors flex items-center gap-5 text-[14px] font-medium text-red-400 group">
            <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Log Out
          </button>
        </div>

        <div className="pb-3">
          <div className="w-full h-[1px] bg-[#101925] mb-2" />
          <div className="px-5 py-2 flex items-center justify-between hover:bg-[#202b36] cursor-pointer" onClick={toggleTheme}>
            <div className="flex items-center gap-5">
              <svg className="w-[22px] h-[22px] text-[#7f91a4]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              <span className="text-[14px] font-medium text-white">Night Mode</span>
            </div>
            <div className={`w-[36px] h-[20px] rounded-full p-[2px] transition-colors ${isNightMode ? 'bg-[#5293d9]' : 'bg-[#7f91a4]'}`}>
              <div className={`w-4 h-4 bg-[#17212b] rounded-full shadow-md transform transition-transform ${isNightMode ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}