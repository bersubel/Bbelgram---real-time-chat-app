'use client'

import { ChatTab } from '@/types/database'

interface FolderSidebarProps {
  activeTab: ChatTab
  setActiveTab: (tab: ChatTab) => void
  isMenuOpen: boolean
  setIsMenuOpen: (isOpen: boolean) => void
}

export default function FolderSidebar({ activeTab, setActiveTab, isMenuOpen, setIsMenuOpen }: FolderSidebarProps) {
  return (
    <div className="w-[80px] bg-[#0e1621] border-r border-[#101925] flex flex-col items-center py-3 gap-2 shrink-0 relative z-30">
      <button 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="p-3 text-[#7f91a4] hover:text-white transition-colors cursor-pointer outline-none mb-2"
      >
        <div className="w-[22px] h-[18px] relative flex flex-col justify-between">
          <span className={`block h-[2px] w-full bg-current rounded-full transition-transform ${isMenuOpen ? 'translate-y-[8px] rotate-45' : ''}`}></span>
          <span className={`block h-[2px] w-full bg-current rounded-full transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block h-[2px] w-full bg-current rounded-full transition-transform ${isMenuOpen ? '-translate-y-[8px] -rotate-45' : ''}`}></span>
        </div>
      </button>

      {/* Personal Folder */}
      <button 
        onClick={() => setActiveTab('personal')}
        className={`w-full py-2 flex flex-col items-center gap-1 transition-colors relative ${activeTab === 'personal' ? 'text-[#3390ec]' : 'text-[#7f91a4] hover:text-[#a0b0c0]'}`}
      >
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0 6.5c-1.42 0-3.92.68-4 2v1h8v-1c-.08-1.32-2.58-2-4-2z"/></svg>
        <span className="text-[12px] font-medium mt-1">Personal</span>
      </button>

      {/* Groups Folder */}
      <button 
        onClick={() => setActiveTab('groups')}
        className={`w-full py-2 flex flex-col items-center gap-1 transition-colors relative mt-1 ${activeTab === 'groups' ? 'text-[#3390ec]' : 'text-[#7f91a4] hover:text-[#a0b0c0]'}`}
      >
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        <span className="text-[12px] font-medium mt-1">Groups</span>
      </button>

      {/* Edit Folder */}
      <button 
        onClick={() => setActiveTab('edit')}
        className={`w-full py-2 flex flex-col items-center gap-1 transition-colors relative mt-1 ${activeTab === 'edit' ? 'text-[#3390ec]' : 'text-[#7f91a4] hover:text-[#a0b0c0]'}`}
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        <span className="text-[12px] font-medium mt-1">Edit</span>
      </button>
    </div>
  )
}