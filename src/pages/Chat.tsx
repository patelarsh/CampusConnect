import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../App.tsx';
import { db, handleFirestoreError } from '../lib/firebase.ts';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { Send, User, Search, MessageSquare, Users, ShieldAlert, Rocket, Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';

export default function Chat() {
  const { user } = useAuth()!;
  const location = useLocation();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [partners, setPartners] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile(data);
        setActiveRoom({ 
          id: `general_${data.collegeName}`, 
          name: `${data.collegeName} - General`, 
          type: 'group' 
        });
      }
    } catch (e) {
      console.error("Error fetching user profile:", e);
    }
  };

  useEffect(() => {
    // Check if we came from 'Apply Now' or 'Dashboard'
    if (location.state?.recipientId) {
      const recipient = { uid: location.state.recipientId, name: location.state.recipientName };
      selectDirectChat(recipient);
    }
  }, [location.state]);

  useEffect(() => {
    if (!user) return;

    // Real-time listener for accepted requests (as sender or recipient)
    const qSender = query(
      collection(db, 'collaborationRequests'),
      where('senderId', '==', user.uid),
      where('status', '==', 'accepted')
    );
    
    const qRecipient = query(
      collection(db, 'collaborationRequests'),
      where('recipientId', '==', user.uid),
      where('status', '==', 'accepted')
    );

    const unsubSender = onSnapshot(qSender, (snap) => {
      const data = snap.docs.map(d => ({ uid: d.data().recipientId, name: d.data().recipientName }));
      setPartners(prev => {
        const others = prev.filter(p => !snap.docs.some(d => d.data().recipientId === p.uid));
        const combined = [...others, ...data];
        // Unique by uid
        return Array.from(new Map(combined.map(item => [item.uid, item])).values());
      });
    }, (err) => {
      console.error("Partners (sender) list error:", err);
      handleFirestoreError(err, 'list', 'collaborationRequests');
    });

    const unsubRecipient = onSnapshot(qRecipient, (snap) => {
      const data = snap.docs.map(d => ({ uid: d.data().senderId, name: d.data().senderName }));
      setPartners(prev => {
        const others = prev.filter(p => !snap.docs.some(d => d.data().senderId === p.uid));
        const combined = [...others, ...data];
        return Array.from(new Map(combined.map(item => [item.uid, item])).values());
      });
    }, (err) => {
      console.error("Partners (recipient) list error:", err);
      handleFirestoreError(err, 'list', 'collaborationRequests');
    });

    return () => {
      unsubSender();
      unsubRecipient();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!activeRoom?.id) return;
    const q = query(collection(db, 'rooms', activeRoom.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      handleFirestoreError(err, 'list', `rooms/${activeRoom.id}/messages`);
    });

    // Typing indicator listener
    const typingQ = query(collection(db, 'rooms', activeRoom.id, 'typing'), where('isTyping', '==', true));
    const unsubTyping = onSnapshot(typingQ, (snap) => {
      const users = snap.docs
        .filter(d => d.id !== user!.uid)
        .map(d => d.data().userName);
      setTypingUsers(users);
    }, (err) => {
      handleFirestoreError(err, 'list', `rooms/${activeRoom.id}/typing`);
    });

    return () => {
      unsubscribe();
      unsubTyping();
    };
  }, [activeRoom?.id]);

  const handleTyping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!activeRoom?.id || !user) return;

    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'rooms', activeRoom.id, 'typing', user.uid), {
        userName: user.displayName || 'Student',
        isTyping: true,
        lastTyped: serverTimestamp()
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(async () => {
        await setDoc(doc(db, 'rooms', activeRoom.id, 'typing', user.uid), {
          isTyping: false
        }, { merge: true });
      }, 3000);
    } catch (e) {
      console.error("Error setting typing status:", e);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectDirectChat = (recipient: any) => {
    // Optional: Check if the recipient is actually a partner
    const isPartner = partners.some(p => p.uid === recipient.uid);
    // During initial mount from location.state, partners might not be loaded yet,
    // so we can either wait or trust the state if it comes from the app's internal navigation.
    // For now, let's keep it simple and just set the room.
    const ids = [user!.uid, recipient.uid].sort();
    const roomId = `dm_${ids[0]}_${ids[1]}`;
    setActiveRoom({ id: roomId, name: recipient.name, type: 'direct' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'rooms', activeRoom.id, 'messages'), {
        senderId: user?.uid,
        senderName: user?.displayName || 'Student',
        text: newMessage,
        createdAt: serverTimestamp(),
      });

      // Send notification for direct messages
      if (activeRoom.type === 'direct') {
        const recipientId = activeRoom.id.split('_').find(id => id !== 'dm' && id !== user!.uid);
        if (recipientId) {
          await addDoc(collection(db, 'notifications'), {
            recipientId,
            senderId: user?.uid,
            senderName: user?.displayName || 'Student',
            type: 'message',
            relatedId: activeRoom.id,
            text: `New message: ${newMessage.substring(0, 50)}${newMessage.length > 50 ? '...' : ''}`,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }

      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, 'create', `rooms/${activeRoom.id}/messages`);
    }
  };

  return (
    <div className="h-[calc(100vh-160px)] flex bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm relative">
      {/* Contact Sidebar */}
      <aside className={`w-full lg:w-80 border-r border-slate-100 flex flex-col absolute lg:relative inset-0 z-20 bg-white transition-transform lg:translate-x-0 ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search partners..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button 
            onClick={() => setShowMobileSidebar(false)}
            className="lg:hidden ml-4 p-2 text-slate-400 hover:text-slate-900"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Active Groups */}
          <div className="p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">Community Hubs</h3>
            <button 
              onClick={() => {
                setActiveRoom({ 
                  id: `general_${userProfile?.collegeName}`, 
                  name: `${userProfile?.collegeName} - General`, 
                  type: 'group' 
                });
                setShowMobileSidebar(false);
              }}
              className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${activeRoom?.id?.startsWith('general_') ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${activeRoom?.id?.startsWith('general_') ? 'bg-indigo-600 shadow-indigo-100' : 'bg-slate-400 shadow-slate-100'}`}>
                <Users size={20} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{userProfile?.collegeName || 'General'} Discussion</p>
                <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter">Campus Locked</p>
              </div>
            </button>
          </div>
          
          {/* Direct Messages (Restricted to Partners) */}
          <div className="p-4 pt-0">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">Your Partners</h3>
             {partners.length === 0 ? (
               <div className="px-2 py-4 text-center space-y-2">
                 <ShieldAlert size={20} className="mx-auto text-slate-300" />
                 <p className="text-[10px] text-slate-400 font-medium">No accepted partners yet. Join a project to start private chats!</p>
               </div>
             ) : (
               partners.map((p) => (
                 <button 
                  key={`partner-${p.uid}`} 
                  onClick={() => {
                    selectDirectChat(p);
                    setShowMobileSidebar(false);
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${activeRoom?.id?.includes(p.uid) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                 >
                   <div className="relative">
                     <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold uppercase">
                       {p.name?.charAt(0) || <User size={16} />}
                     </div>
                     <div className="absolute right-0 bottom-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                   </div>
                   <div className="flex-1 text-left">
                     <p className="text-sm font-bold truncate">{p.name}</p>
                     <p className="text-xs text-slate-500">Project Partner</p>
                   </div>
                 </button>
               ))
             )}
          </div>
        </div>
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeRoom ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-indigo-600">
                <Loader2 className="animate-spin" size={32} />
             </div>
             <p className="text-slate-500 font-medium">Initializing secure chat room...</p>
          </div>
        ) : (
          <>
            <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => setShowMobileSidebar(true)}
                  className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-xl"
                 >
                   <Users size={20} />
                 </button>
                 <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 hidden sm:flex">
                   {activeRoom.type === 'group' ? <Users size={20} /> : <User size={20} />}
                 </div>
                 <div>
                    <h2 className="text-sm md:text-base font-bold text-slate-900 leading-none mb-1 truncate max-w-[150px] md:max-w-none">{activeRoom.name}</h2>
                    <p className="text-[10px] md:text-xs text-slate-500 font-medium italic">
                      {activeRoom.type === 'group' ? 'Synced with General Discussion' : 'Private Direct Message'}
                    </p>
                 </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="text-center my-4">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Beginning of conversation</span>
              </div>

              {messages.map((msg) => (
                <motion.div
                  key={`msg-${msg.id}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-3 ${msg.senderId === user?.uid ? 'flex-row-reverse' : ''}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 text-xs font-bold">
                    {msg.senderName?.charAt(0) || 'U'}
                  </div>
                  <div className={`max-w-[70%] p-3 rounded-2xl ${
                    msg.senderId === user?.uid 
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm' 
                      : 'bg-slate-100 text-slate-900 rounded-tl-none'
                  }`}>
                    <div className="flex items-center justify-between gap-4 mb-1">
                      {msg.senderId !== user?.uid && <p className="text-[10px] font-bold opacity-70 uppercase tracking-tighter">{msg.senderName}</p>}
                      <p className={`text-[8px] font-bold opacity-40 uppercase tracking-widest ${msg.senderId === user?.uid ? 'ml-auto' : ''}`}>
                        {msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                </motion.div>
              ))}
              
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 italic animate-pulse px-11">
                  <span>{typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...</span>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 pt-0">
               <div className="p-2 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/50 transition-all">
                 <input
                   value={newMessage}
                   onChange={handleTyping}
                   placeholder="Type a message..."
                   className="flex-1 bg-transparent px-4 py-3 text-sm outline-none font-medium"
                 />
                 <button
                   type="submit"
                   className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                 >
                   <Send size={18} />
                 </button>
               </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
