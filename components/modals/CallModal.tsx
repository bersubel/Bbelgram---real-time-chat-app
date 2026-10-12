'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack
} from '@livekit/components-react'
import { Track } from 'livekit-client'

interface CallModalProps {
  chatId: string
  currentUser: Profile
  callType: 'voice' | 'video'
  chatName: string
  chatAvatar: string
  incomingCallId?: string | null
  onClose: () => void
}

export default function CallModal({ chatId, currentUser, callType, chatName, chatAvatar, incomingCallId, onClose }: CallModalProps) {
  const supabase = createClient()
  
  const [activeCallId, setActiveCallId] = useState<string | null>(incomingCallId || null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [duration, setDuration] = useState(0)
  const [token, setToken] = useState('')
  
  // Local UI states
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  
  // Minimize State
  const [isMinimized, setIsMinimized] = useState(false)
  
  // Dragging State for PiP mode
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  
  // Add People states
  const [showAddModal, setShowAddModal] = useState(false)
  const [addUsername, setAddUsername] = useState('')
  const [addError, setAddError] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const isReceiver = !!incomingCallId
  const channelRef = useRef<any>(null)

  // 1. Initialize Call (Supabase Signaling)
  useEffect(() => {
    let callRecordId = incomingCallId

    const setupCall = async () => {
      if (!isReceiver) {
        const { data } = await supabase.from('calls').insert([{
          chat_id: chatId, caller_id: currentUser.id, call_type: callType, status: 'ongoing'
        }]).select('id').single()
        
        if (data) {
          callRecordId = data.id
          setActiveCallId(data.id)
        }
      }

      if (!callRecordId) return

      const channel = supabase.channel(`call_${callRecordId}`)
      channel.on('broadcast', { event: 'call-action' }, (payload) => {
        if (payload.payload.action === 'answered') setIsAnswered(true)
        if (payload.payload.action === 'ended') onClose() 
      }).subscribe()

      channelRef.current = channel
    }

    setupCall()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [chatId, currentUser.id, callType, isReceiver, incomingCallId, supabase, onClose])

  // 1.5 Ringing Audio & 2-Minute Timeout Logic
  useEffect(() => {
    let ringAudio: HTMLAudioElement | null = null
    let timeoutId: NodeJS.Timeout

    if (!isAnswered) {
      ringAudio = new Audio('https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg')
      ringAudio.loop = true
      ringAudio.play().catch(e => console.log("Browser blocked auto-play:", e))

      timeoutId = setTimeout(async () => {
        if (activeCallId && channelRef.current) {
          await channelRef.current.send({ type: 'broadcast', event: 'call-action', payload: { action: 'ended' } })
          await supabase.from('calls').update({ status: 'missed', ended_at: new Date().toISOString() }).eq('id', activeCallId)
          await supabase.from('messages').insert([{ 
            chat_id: chatId, sender_id: currentUser.id, content: 'Missed Call', file_type: `call/${callType}`, file_name: 'missed' 
          }])
        }
        onClose()
      }, 120000)
    }

    return () => {
      if (ringAudio) {
        ringAudio.pause()
        ringAudio.currentTime = 0
      }
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isAnswered, activeCallId, chatId, currentUser.id, callType, supabase, onClose])

  // 2. Fetch LiveKit Token
  useEffect(() => {
    if (isReceiver && !isAnswered) return

    const fetchToken = async () => {
      try {
        const res = await fetch(`/api/livekit?room=${chatId}&username=${currentUser.username || currentUser.id}`)
        const data = await res.json()
        setToken(data.token)
      } catch (err) {
        console.error("Failed to fetch LiveKit token", err)
      }
    }
    fetchToken()
  }, [isReceiver, isAnswered, chatId, currentUser.username, currentUser.id])

  // 3. Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isAnswered) {
      timer = setInterval(() => setDuration(prev => prev + 1), 1000)
    }
    return () => clearInterval(timer)
  }, [isAnswered])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // 4. Actions
  const handleAnswer = async () => {
    setIsAnswered(true)
    if (channelRef.current) {
      await channelRef.current.send({ type: 'broadcast', event: 'call-action', payload: { action: 'answered' } })
    }
  }

  const handleEndCall = async () => {
    if (activeCallId) {
      if (channelRef.current) {
        await channelRef.current.send({ type: 'broadcast', event: 'call-action', payload: { action: 'ended' } })
      }
      await supabase.from('calls').update({ status: isAnswered ? 'ended' : 'missed', ended_at: new Date().toISOString() }).eq('id', activeCallId)
      
      const isMissed = !isAnswered
      const timeString = isMissed ? 'Missed Call' : `${callType === 'video' ? 'Video' : 'Voice'} Call (${formatTime(duration)})`
      
      await supabase.from('messages').insert([{
        chat_id: chatId, sender_id: currentUser.id, content: timeString, file_type: `call/${callType}`, file_name: isMissed ? 'missed' : 'ended'
      }])
    }
    onClose()
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    setIsAdding(true)

    const cleanUsername = addUsername.replace('@', '').trim()
    if (cleanUsername === currentUser.username) {
      setAddError("Cannot add yourself.")
      setIsAdding(false)
      return
    }

    const { data: targetProfile } = await supabase.from('profiles').select('id').eq('username', cleanUsername).single()
    if (!targetProfile) {
      setAddError("User not found.")
      setIsAdding(false)
      return
    }

    const { data: existingMember } = await supabase.from('chat_members').select('user_id').eq('chat_id', chatId).eq('user_id', targetProfile.id).single()
    if (!existingMember) {
      await supabase.from('chat_members').insert([{ chat_id: chatId, user_id: targetProfile.id, role: 'member' }])
    }

    await supabase.from('calls').insert([{
      chat_id: chatId, caller_id: currentUser.id, call_type: callType, status: 'ongoing'
    }])

    setShowAddModal(false)
    setAddUsername('')
    setIsAdding(false)
  }

  // 5. Drag Handlers for PiP Mode
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isMinimized) return
    isDragging.current = true
    dragStart.current = { x: e.clientX - dragPos.x, y: e.clientY - dragPos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !isMinimized) return
    setDragPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // Minimize logic resets position
  const handleMinimize = () => {
    setDragPos({ x: 0, y: 0 })
    setIsMinimized(true)
  }

  const controlBtnBase = "w-[50px] h-[50px] sm:w-[60px] sm:h-[60px] rounded-full flex items-center justify-center transition-all relative z-10 shrink-0"
  const labelStyle = "text-[#b0b3b8] text-[11px] sm:text-[13px] mt-1.5 sm:mt-2 font-medium hidden sm:block" 
  
  // Responsive Minimized View with Dynamic Transform styling
  const modalClasses = isMinimized 
    ? `fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[140px] h-[190px] sm:w-[280px] sm:h-[380px] z-[9999] flex flex-col bg-[#1c1f24] font-sans rounded-2xl shadow-2xl border border-white/10 overflow-hidden cursor-move touch-none ${!isDragging.current ? 'transition-all duration-300' : ''}`
    : "fixed inset-0 z-[9999] flex flex-col bg-[#1c1f24] font-sans transition-all duration-300 transform-none"

  return (
    <div 
      className={modalClasses}
      style={isMinimized ? { transform: `translate(${dragPos.x}px, ${dragPos.y}px)` } : {}}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      
      {/* Minimize / Restore Buttons */}
      {!isMinimized ? (
        <button onClick={handleMinimize} className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 bg-black/40 hover:bg-black/60 text-white p-2 sm:p-2.5 rounded-full backdrop-blur-md transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
      ) : (
        <div className="absolute inset-0 z-[100] group">
          {/* We isolate the maximize button so dragging doesn't accidentally trigger maximizing */}
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }} className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-black/60 hover:bg-black/80 p-1.5 sm:p-2 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all z-[110]">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          <button onClick={(e) => { e.stopPropagation(); handleEndCall(); }} className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 bg-red-500 hover:bg-red-600 p-2 sm:p-3 rounded-full text-white shadow-lg transition-colors z-[110]">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 transform rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
          </button>
        </div>
      )}

      {/* Top Timer Pill */}
      {isAnswered && !isMinimized && (
        <div className="absolute top-4 sm:top-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="bg-black/40 border border-white/10 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-white text-xs sm:text-sm font-medium backdrop-blur-md shadow-lg">
            {formatTime(duration)}
          </div>
        </div>
      )}

      {/* Main Call Area */}
      {token ? (
        <LiveKitRoom
          video={isVideoOn}
          audio={!isMuted}
          screen={isScreenSharing}
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          className="flex-1 flex flex-col w-full h-full relative"
        >
          {isAnswered && (
            <ParticipantGrid 
              isVideoCall={callType === 'video'} 
              remoteAvatar={chatAvatar} 
              remoteName={chatName} 
              localAvatar={currentUser.avatar_url || null} 
              isMinimized={isMinimized}
            />
          )}
          <RoomAudioRenderer />
          <LocalMediaManager isMuted={isMuted} isVideoOn={isVideoOn} isScreenSharing={isScreenSharing} />
        </LiveKitRoom>
      ) : (
        <div className="flex-1" />
      )}

      {/* Ringing State Overlay */}
      {!isAnswered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-10 sm:-mt-20 z-10">
          <img src={chatAvatar} alt={chatName} className={`${isMinimized ? 'w-[60px] h-[60px]' : 'w-[100px] h-[100px] sm:w-[140px] sm:h-[140px]'} rounded-full object-cover mb-4 sm:mb-6 border border-[#2d3136] transition-all pointer-events-none`} />
          <h2 className={`text-white ${isMinimized ? 'text-[16px]' : 'text-[22px] sm:text-[28px]'} tracking-wide mb-1 transition-all text-center px-4`}>{chatName}</h2>
          <p className="text-[#aeb1b6] text-[13px] sm:text-[15px]">
            {isReceiver ? 'Incoming call...' : 'ringing...'}
          </p>
        </div>
      )}

      {/* Add People Mini-Modal */}
      {showAddModal && !isMinimized && (
        <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#17212b] w-full max-w-sm rounded-2xl p-5 sm:p-6 shadow-2xl border border-[#242f3d]">
            <h2 className="text-white font-semibold text-[16px] sm:text-[18px] mb-4">Add to Call</h2>
            <form onSubmit={handleAddUser}>
              <div className="flex items-center bg-[#242f3d] rounded-xl px-3 py-2 focus-within:border-[#5293d9] border border-transparent transition-colors">
                <span className="text-[#7f91a4] mr-1">@</span>
                <input
                  type="text"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="username"
                  className="flex-1 bg-transparent border-none text-white outline-none text-[14px] sm:text-[15px]"
                  autoFocus
                />
              </div>
              {addError && <p className="text-red-400 text-[12px] sm:text-[13px] mt-2">{addError}</p>}
              <div className="flex justify-end gap-2 mt-5 sm:mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 sm:px-4 py-1.5 sm:py-2 text-white hover:bg-[#242f3d] rounded-lg transition-colors text-[13px] sm:text-[14px]">Cancel</button>
                <button type="submit" disabled={isAdding || !addUsername.trim()} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#5293d9] hover:bg-[#4784c4] text-white rounded-lg transition-colors text-[13px] sm:text-[14px] disabled:opacity-50">
                  {isAdding ? 'Ringing...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Controls Overlay */}
      {!isMinimized && (
        <div className="absolute bottom-6 sm:bottom-12 left-0 right-0 flex flex-row items-start justify-center gap-3 sm:gap-5 px-4 pointer-events-auto z-50">
          
          {isReceiver && !isAnswered && (
            <div className="flex flex-col items-center">
              <button onClick={handleAnswer} className={`${controlBtnBase} bg-[#23a559] hover:bg-[#1f934f] text-white`}>
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
              </button>
              <span className={labelStyle}>Accept</span>
            </div>
          )}

          <div className="flex flex-col items-center">
            <button onClick={() => setIsScreenSharing(!isScreenSharing)} className={`${controlBtnBase} ${isScreenSharing ? 'bg-[#3c4043] hover:bg-[#4d5155] text-white' : 'bg-white hover:bg-gray-200 text-[#1c1f24]'}`}>
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </button>
            <span className={labelStyle}>Screencast</span>
          </div>

          <div className="flex flex-col items-center">
            <button onClick={() => setIsVideoOn(!isVideoOn)} className={`${controlBtnBase} ${!isVideoOn ? 'bg-[#3c4043] hover:bg-[#4d5155] text-white' : 'bg-white hover:bg-gray-200 text-[#1c1f24]'}`}>
              <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 bg-[#3c4043] rounded-full flex items-center justify-center border-2 border-[#1c1f24]">
                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
              </div>
              {isVideoOn ? (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              ) : (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" /></svg>
              )}
            </button>
            <span className={labelStyle}>{isVideoOn ? 'Stop Video' : 'Start Video'}</span>
          </div>

          <div className="flex flex-col items-center">
            <button onClick={handleEndCall} className={`${controlBtnBase} bg-[#ea4335] hover:bg-[#d93025] text-white`}>
              <svg className="w-6 h-6 sm:w-8 sm:h-8 transform rotate-[135deg]" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
            </button>
            <span className={labelStyle}>End Call</span>
          </div>

          <div className="flex flex-col items-center">
            <button onClick={() => setIsMuted(!isMuted)} className={`${controlBtnBase} ${isMuted ? 'bg-white text-[#1c1f24]' : 'bg-[#3c4043] hover:bg-[#4d5155] text-white'}`}>
              <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 bg-[#3c4043] rounded-full flex items-center justify-center border-2 border-[#1c1f24]">
                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
              </div>
              {isMuted ? (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3zM3 3l18 18" /></svg>
              ) : (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              )}
            </button>
            <span className={labelStyle}>{isMuted ? 'Unmute' : 'Mute'}</span>
          </div>

          {isAnswered && (
            <div className="flex flex-col items-center transition-all">
              <button onClick={() => setShowAddModal(true)} className={`${controlBtnBase} bg-[#3c4043] hover:bg-[#4d5155] text-white`}>
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </button>
              <span className={labelStyle}>Add People</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------
// LIVEKIT DYNAMIC GRID COMPONENTS
// --------------------------------------------------------

function ParticipantGrid({ isVideoCall, remoteAvatar, remoteName, localAvatar, isMinimized }: { isVideoCall: boolean, remoteAvatar: string, remoteName: string, localAvatar: string | null, isMinimized: boolean }) {
  const participants = useParticipants()
  const count = participants.length
  
  // FIXED DESKTOP SIZING: 3 or 4 participants now use 50% width (creating a 2x2 grid) instead of being tiny.
  let sizingClass = 'w-full max-w-4xl' 
  if (count === 2) {
    sizingClass = 'w-full sm:w-[calc(50%-0.5rem)] max-w-3xl' 
  } else if (count === 3 || count === 4) {
    sizingClass = 'w-[calc(50%-0.25rem)] sm:w-[calc(50%-0.5rem)] max-w-3xl'
  } else if (count >= 5) {
    sizingClass = 'w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.5rem)] max-w-lg'
  }
      
  const gridPadding = isMinimized ? 'p-1 sm:p-2' : 'p-3 pt-16 pb-[100px] sm:p-6 sm:pt-20 sm:pb-[140px]'

  return (
    <div className={`absolute inset-0 ${gridPadding} flex flex-wrap items-center justify-center content-center gap-2 sm:gap-4 z-0 overflow-y-auto w-full h-full pointer-events-none`}>
      {participants.map(p => (
        <div key={p.identity} className={`${sizingClass} aspect-[4/3] sm:aspect-video relative bg-[#1c1f24] rounded-xl sm:rounded-2xl overflow-hidden border border-[#2d3136] shadow-xl flex items-center justify-center min-h-[160px] sm:min-h-[200px] pointer-events-auto`}>
          <ParticipantTile 
            participant={p} 
            isVideoCall={isVideoCall} 
            remoteAvatar={remoteAvatar} 
            remoteName={remoteName} 
            localAvatar={localAvatar} 
          />
        </div>
      ))}
    </div>
  )
}

function ParticipantTile({ participant, isVideoCall, remoteAvatar, remoteName, localAvatar }: any) {
  const isLocal = participant.isLocal

  const cameraTracks = useTracks([Track.Source.Camera]).filter(t => t.participant.identity === participant.identity)
  const cameraTrack = cameraTracks.length > 0 ? cameraTracks[0] : null

  const screenTracks = useTracks([Track.Source.ScreenShare]).filter(t => t.participant.identity === participant.identity)
  const screenTrack = screenTracks.length > 0 ? screenTracks[0] : null

  const displayName = isLocal ? 'You' : (participant.name || participant.identity || remoteName)
  const displayAvatar = isLocal ? (localAvatar || `https://ui-avatars.com/api/?name=You&background=random`) : remoteAvatar
  
  const isScreening = !!screenTrack
  const showVideo = isVideoCall && cameraTrack && !isScreening

  return (
    <>
      {isScreening ? (
        // SCREENSHARE FIX: No inversion, object-contain so text isn't cut off
        <VideoTrack 
          trackRef={screenTrack} 
          className="absolute inset-0 w-full h-full object-contain bg-black" 
        />
      ) : showVideo ? (
        // YOUR CAMERA SETTINGS: Inversion perfectly intact
        <VideoTrack 
          trackRef={cameraTrack} 
          style={{ transform: 'scaleX(-1)' }}
          className="absolute inset-0 w-full h-full object-cover" 
        />
      ) : (
        <div className="flex flex-col items-center">
          <img src={displayAvatar} alt={displayName} className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full shadow-lg border-2 sm:border-4 border-[#1c1f24] z-10" />
        </div>
      )}

      {/* Name and Mute Badge */}
      <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-[#1c1f24]/80 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-white text-[11px] sm:text-[13px] flex items-center gap-1.5 sm:gap-2 backdrop-blur-md z-20 border border-white/5 shadow-sm">
        <span className="font-medium truncate max-w-[80px] sm:max-w-[150px]">
          {displayName} {isScreening ? "'s Screen" : ""}
        </span>
        
        {!participant.isMicrophoneEnabled && (
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#ea4335]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </>
  )
}

function LocalMediaManager({ isMuted, isVideoOn, isScreenSharing }: { isMuted: boolean, isVideoOn: boolean, isScreenSharing: boolean }) {
  const { localParticipant } = useLocalParticipant()

  useEffect(() => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!isMuted)
      localParticipant.setCameraEnabled(isVideoOn)
      localParticipant.setScreenShareEnabled(isScreenSharing)
    }
  }, [localParticipant, isMuted, isVideoOn, isScreenSharing])

  return null
}