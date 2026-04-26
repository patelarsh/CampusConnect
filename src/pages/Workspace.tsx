import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.tsx';
import { db, handleFirestoreError } from '../lib/firebase.ts';
import { 
  doc, getDoc, collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, deleteDoc, serverTimestamp, 
  where, setDoc 
} from 'firebase/firestore';
import { 
  Rocket, Users, ListFilter, Plus, CheckCircle2, 
  Paperclip, Image as ImageIcon, Link as LinkIcon, 
  MessageSquare, Send, ArrowLeft, MoreVertical, 
  Clock, AlertCircle, FileText, ExternalLink, Trash2,
  User, ShieldCheck, Mail, ShieldAlert,
  Loader2, Calendar, StickyNote, BookOpen, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { openPicker } from '../lib/googleDrive.ts';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

type Task = {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  assigneeId?: string;
  assigneeName?: string;
  createdAt: any;
};

type Resource = {
  id: string;
  name: string;
  url: string;
  type: 'file' | 'image' | 'link';
  uploadedBy: string;
  createdAt: any;
};

type Note = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorId: string;
  createdAt: any;
};

export default function Workspace() {
  const { id } = useParams();
  const { user } = useAuth()!;
  const navigate = useNavigate();
  
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'board' | 'drive' | 'chat' | 'notes' | 'members'>('board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [newResourceType, setNewResourceType] = useState<'file' | 'image' | 'link'>('link');
  const [newMessage, setNewMessage] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  const [newTaskAssignee, setNewTaskAssignee] = useState<{id: string, name: string} | null>(null);
  const [collaboratorDetails, setCollaboratorDetails] = useState<Record<string, any>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [presence, setPresence] = useState<Record<string, any>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastRead, setLastRead] = useState<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;
    fetchProject();
  }, [id, user]);

  useEffect(() => {
    if (!id || activeTab !== 'chat') return;
    const qTyping = query(collection(db, 'rooms', `proj_${id}`, 'typing'));
    const unsubTyping = onSnapshot(qTyping, (snap) => {
      const users = snap.docs
        .filter(d => d.id !== user.uid)
        .map(d => d.data().name || 'Someone');
      setTypingUsers(Array.from(new Set(users)));
    }, (err) => {
      handleFirestoreError(err, 'list', `rooms/proj_${id}/typing`);
    });
    return () => unsubTyping();
  }, [id, activeTab, user.uid]);

  // Presence logic
  useEffect(() => {
    if (!id || !user) return;
    
    const updatePresence = async () => {
      try {
        const statuses: Record<string, string> = {
          'board': 'Viewing Tasks',
          'chat': 'In Chat',
          'notes': 'Reading Notes',
          'drive': 'Browsing Resources',
          'members': 'Checking Team'
        };

        await setDoc(doc(db, 'posts', id, 'presence', user.uid), {
          lastSeen: serverTimestamp(),
          name: user.displayName,
          photoURL: user.photoURL,
          activity: statuses[activeTab] || 'Active',
          tab: activeTab
        });
      } catch (e) {
        // Silent error for presence
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000); // Update every 30s

    const qPresence = query(collection(db, 'posts', id, 'presence'));
    const unsubPresence = onSnapshot(qPresence, (snap) => {
      const p: Record<string, any> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const lastSeen = data.lastSeen?.toMillis() || 0;
        const diff = Date.now() - lastSeen;
        
        let status = 'offline';
        if (diff < 60000) status = 'online';
        else if (diff < 300000) status = 'away';
        
        p[d.id] = { ...data, presenceStatus: status };
      });
      setPresence(p);
    }, (err) => {
      handleFirestoreError(err, 'list', `posts/${id}/presence`);
    });

    return () => {
      clearInterval(interval);
      unsubPresence();
      // Optional: clear presence on unmount
      deleteDoc(doc(db, 'posts', id, 'presence', user.uid)).catch(() => {});
    };
  }, [id, user, activeTab]);

  // Unread count logic
  useEffect(() => {
    if (!id || !user) return;

    const unsubReadState = onSnapshot(doc(db, 'rooms', `proj_${id}`, 'readState', user.uid), (snap) => {
      if (snap.exists()) {
        setLastRead(snap.data().lastRead);
      }
    }, (err) => {
      handleFirestoreError(err, 'get', `rooms/proj_${id}/readState/${user.uid}`);
    });

    return () => unsubReadState();
  }, [id, user]);

  useEffect(() => {
    if (!messages.length) {
      setUnreadCount(0);
      return;
    }

    if (activeTab === 'chat') {
      setUnreadCount(0);
      updateLastRead();
    } else {
      const count = messages.filter(m => {
        if (!m.createdAt) return false;
        if (!lastRead) return true;
        return m.createdAt.toMillis() > lastRead.toMillis();
      }).length;
      setUnreadCount(count);
    }
  }, [messages, activeTab, lastRead]);

  const updateLastRead = async () => {
    if (!id || !user || activeTab !== 'chat') return;
    try {
      await setDoc(doc(db, 'rooms', `proj_${id}`, 'readState', user.uid), {
        lastRead: serverTimestamp()
      });
    } catch (e) {
      // Silent error
    }
  };

  const handleTyping = async () => {
    if (!id || !user) return;
    try {
      await setDoc(doc(db, 'rooms', `proj_${id}`, 'typing', user.uid), {
        name: user.displayName || user.email?.split('@')[0],
        timestamp: serverTimestamp()
      });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        try {
          await deleteDoc(doc(db, 'rooms', `proj_${id}`, 'typing', user.uid));
        } catch (err) {
          // Ignore delete errors on cleanup
        }
      }, 3000);
    } catch (err) {
      // Ignore typing errors
    }
  };

  const fetchProject = async () => {
    try {
      const docRef = doc(db, 'posts', id!);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        setError('Project not found');
        return;
      }
      const data = docSnap.data();
      const isMember = user.isAdmin || data.authorId === user.uid || data.collaborators?.includes(user.uid);
      if (!isMember) {
        setError('Unauthorized access to this workspace');
        return;
      }
      setProject({ id: docSnap.id, ...data });
      
      // Fetch collaborator names including the project owner
      const allCollaborators = [data.authorId, ...(data.collaborators || [])];
      const uniqueUids = Array.from(new Set(allCollaborators));
      const details: Record<string, any> = {};
      
      for (const uid of uniqueUids) {
        const uDoc = await getDoc(doc(db, 'users', uid));
        if (uDoc.exists()) {
          details[uid] = uDoc.data();
        }
      }
      setCollaboratorDetails(details);

      setLoading(false);
    } catch (e) {
      handleFirestoreError(e, 'get', `posts/${id}`);
      setError('Failed to load project details');
    }
  };

  useEffect(() => {
    if (!id || loading || error) return;

    // Listeners
    const qTasks = query(collection(db, 'posts', id, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    }, (err) => {
      handleFirestoreError(err, 'list', `posts/${id}/tasks`);
    });

    const qDrive = query(collection(db, 'posts', id, 'resources'), orderBy('createdAt', 'desc'));
    const unsubDrive = onSnapshot(qDrive, (snap) => {
      setResources(snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
    }, (err) => {
      handleFirestoreError(err, 'list', `posts/${id}/resources`);
    });
    
    const qNotes = query(collection(db, 'posts', id, 'notes'), orderBy('createdAt', 'desc'));
    const unsubNotes = onSnapshot(qNotes, (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note)));
    }, (err) => {
      handleFirestoreError(err, 'list', `posts/${id}/notes`);
    });

    const qChat = query(collection(db, 'rooms', `proj_${id}`, 'messages'), orderBy('createdAt', 'asc'));
    const unsubChat = onSnapshot(qChat, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      handleFirestoreError(err, 'list', `rooms/proj_${id}/messages`);
    });

    const unsubProject = onSnapshot(doc(db, 'posts', id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProject(prev => ({ ...prev, ...data }));
      }
    }, (err) => {
      handleFirestoreError(err, 'get', `posts/${id}`);
    });

    return () => {
      unsubTasks();
      unsubDrive();
      unsubNotes();
      unsubChat();
      unsubProject();
    };
  }, [id, loading, error]);

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await addDoc(collection(db, 'posts', id!, 'tasks'), {
        title: newTaskTitle,
        status: 'todo',
        priority: newTaskPriority,
        dueDate: newTaskDueDate ? newTaskDueDate.toISOString() : null,
        assigneeId: newTaskAssignee?.id || null,
        assigneeName: newTaskAssignee?.name || null,
        createdAt: serverTimestamp()
      });
      setNewTaskTitle('');
      setNewTaskPriority('medium');
      setNewTaskDueDate(null);
      setNewTaskAssignee(null);
    } catch (e) {
      handleFirestoreError(e, 'create', `posts/${id}/tasks`);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'posts', id!, 'tasks', taskId), { status });
    } catch (e) {
      handleFirestoreError(e, 'update', `posts/${id}/tasks/${taskId}`);
    }
  };

  const deleteProjectTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', id!, 'tasks', taskId));
    } catch (e) {
      handleFirestoreError(e, 'delete', `posts/${id}/tasks/${taskId}`);
    }
  };

  const addResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResourceName.trim() || !newResourceUrl.trim()) return;
    try {
      await addDoc(collection(db, 'posts', id!, 'resources'), {
        name: newResourceName,
        url: newResourceUrl,
        type: newResourceType,
        uploadedBy: user.displayName,
        createdAt: serverTimestamp()
      });
      setNewResourceName('');
      setNewResourceUrl('');
    } catch (e) {
      handleFirestoreError(e, 'create', 'resources');
    }
  };

  const handleDriveImport = async () => {
    try {
      const pickedFile = await openPicker();
      if (pickedFile) {
        await addDoc(collection(db, 'posts', id!, 'resources'), {
          name: pickedFile.name,
          url: pickedFile.url || pickedFile.embedUrl || `https://drive.google.com/open?id=${pickedFile.id}`,
          type: pickedFile.mimeType.includes('image') ? 'image' : 'file',
          uploadedBy: user.displayName || 'Team Member',
          createdAt: serverTimestamp()
        });
      }
    } catch (e: any) {
      if (e.message !== 'Picker cancelled') {
        console.error('Drive import failed:', e);
        alert(e.message || 'Failed to import from Google Drive');
      }
    }
  };

  const deleteResource = async (resId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', id!, 'resources', resId));
    } catch (e) {
      handleFirestoreError(e, 'delete', `posts/${id}/resources/${resId}`);
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    try {
      await addDoc(collection(db, 'posts', id!, 'notes'), {
        title: newNoteTitle,
        content: newNoteContent,
        authorName: user.displayName,
        authorId: user.uid,
        createdAt: serverTimestamp()
      });
      setNewNoteTitle('');
      setNewNoteContent('');
      setShowNoteModal(false);
    } catch (e) {
      handleFirestoreError(e, 'create', `posts/${id}/notes`);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', id!, 'notes', noteId));
    } catch (e) {
      handleFirestoreError(e, 'delete', `posts/${id}/notes/${noteId}`);
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const messageToSend = newMessage;
    setNewMessage('');
    try {
      await addDoc(collection(db, 'rooms', `proj_${id}`, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName,
        text: messageToSend,
        createdAt: serverTimestamp()
      });
      
      // Handle mentions
      const mentions = messageToSend.match(/@(\w+)/g);
      if (mentions) {
        const uniqueMentions = Array.from(new Set(mentions.map(m => m.substring(1).toLowerCase())));
        for (const mentionName of uniqueMentions) {
          const mentionedUid = Object.keys(collaboratorDetails).find(uid => {
             const name = (collaboratorDetails[uid].name || collaboratorDetails[uid].displayName || '').toLowerCase().replace(/\s/g, '');
             const firstName = (collaboratorDetails[uid].name || collaboratorDetails[uid].displayName || '').split(' ')[0].toLowerCase();
             return name === mentionName || firstName === mentionName;
          });

          if (mentionedUid && mentionedUid !== user.uid) {
            await addDoc(collection(db, 'notifications'), {
              recipientId: mentionedUid,
              senderName: user.displayName,
              type: 'mention',
              title: 'Team Mention',
              text: `${user.displayName} mentioned you in "${project.title}"`,
              link: `/workspace/${id}?tab=chat`,
              read: false,
              createdAt: serverTimestamp()
            });
          }
        }
      }
    } catch (e) {
      handleFirestoreError(e, 'create', `rooms/proj_${id}/messages`);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
       <Loader2 className="animate-spin text-indigo-600 mr-2" />
       <span className="font-bold text-slate-400 uppercase tracking-widest">Loading Workspace...</span>
    </div>
  );

  if (error) return (
    <div className="p-12 text-center max-w-md mx-auto">
       <AlertCircle size={48} className="text-rose-500 mx-auto mb-4" />
       <h1 className="text-2xl font-bold text-slate-900 mb-2">Error Loading Workspace</h1>
       <p className="text-slate-500 mb-6 font-medium">{error}</p>
       <button onClick={() => navigate('/projects')} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">
          Back to Projects
       </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col font-sans relative">
      {/* Workspace Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div className="flex items-center gap-4">
           <button onClick={() => navigate('/projects')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <ArrowLeft size={20} />
           </button>
           <div>
              <div className="flex items-center gap-2 mb-1">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Active Workspace</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{project.title}</h1>
           </div>
        </div>
          <div className="flex items-center gap-3">
             <div className="flex -space-x-2 mr-4">
                {Array.from(new Set([project.authorId, ...(project.collaborators || [])])).slice(0, 4).map((uid, i) => {
                  const p = presence[uid];
                  const status = p?.presenceStatus || 'offline';
                  const isOnline = status === 'online';
                  const isAway = status === 'away';
                  
                  return (
                    <div key={`collab-avatar-${uid}`} className="relative group/avatar">
                      <div className={`w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 ring-2 transition-all ${isOnline ? 'ring-emerald-400' : isAway ? 'ring-amber-400' : 'ring-slate-50'}`}>
                        {collaboratorDetails[uid]?.photoURL ? (
                          <img src={collaboratorDetails[uid].photoURL} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User size={12} />
                        )}
                      </div>
                      {isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />}
                      {isAway && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-amber-500 border-2 border-white rounded-full shadow-sm" />}
                      <div className="absolute top-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-900 text-white text-[8px] font-bold rounded-lg opacity-0 group-hover/avatar:opacity-100 transition-all whitespace-nowrap z-50 shadow-xl border border-slate-800">
                        <div className="flex flex-col gap-0.5">
                           <span>{collaboratorDetails[uid]?.name || collaboratorDetails[uid]?.displayName || 'Member'}</span>
                           {(isOnline || isAway) && (
                             <span className={`${isOnline ? 'text-emerald-400' : 'text-amber-400'} text-[7px] flex items-center gap-1`}>
                               <span className={`w-1 h-1 ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'} rounded-full`} />
                               {presence[uid]?.activity || (isAway ? 'Away' : 'Active')}
                             </span>
                           )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {((project.collaborators?.length || 0) + 1) > 4 && (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-600 flex items-center justify-center text-[8px] font-black text-white ring-2 ring-indigo-50">
                    +{(project.collaborators?.length || 0) + 1 - 4}
                  </div>
                )}
             </div>
             <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 shadow-sm transition-all hover:border-slate-300">
                <MoreVertical size={20} />
             </button>
          </div>
        </header>

      {/* Workspace Navigation */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-[1.25rem] w-full md:w-fit mb-8 shadow-inner border border-slate-200/50">
         {[
           { id: 'board', name: 'Tasks', icon: ListFilter },
           { id: 'notes', name: 'Notes', icon: StickyNote },
           { id: 'drive', name: 'Shared Resources', icon: Paperclip },
           { id: 'members', name: 'Members', icon: Users },
           { id: 'chat', name: 'Team Chat', icon: MessageSquare }
         ].map((tab) => {
           const usersInTab = Object.entries(presence)
             .filter(([uid, p]) => p.tab === tab.id && p.presenceStatus === 'online' && uid !== user.uid)
             .map(([uid, p]) => ({ uid, ...p }));

           return (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex items-center gap-2 px-6 py-2.5 rounded-[0.9rem] text-xs font-bold uppercase tracking-widest transition-all relative ${
                 activeTab === tab.id 
                   ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5' 
                   : 'text-slate-400 hover:text-slate-600'
               }`}
             >
               <tab.icon size={14} />
               {tab.name}
               
               {/* Tab Presence Avatars */}
               {usersInTab.length > 0 && (
                 <div className="flex -space-x-1.5 ml-2">
                   {usersInTab.slice(0, 3).map((u) => (
                     <div key={`tab-presence-${tab.id}-${u.uid}`} className="w-4 h-4 rounded-full border border-white bg-slate-200 overflow-hidden ring-1 ring-emerald-400/50">
                        {u.photoURL ? (
                          <img src={u.photoURL} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-200">
                             <User size={8} className="text-slate-400" />
                          </div>
                        )}
                     </div>
                   ))}
                   {usersInTab.length > 3 && (
                     <div className="w-4 h-4 rounded-full border border-white bg-slate-200 flex items-center justify-center text-[6px] font-black">
                       +{usersInTab.length - 3}
                     </div>
                   )}
                 </div>
               )}

               {tab.id === 'chat' && unreadCount > 0 && (
                 <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white shadow-sm ring-2 ring-white animate-bounce">
                   {unreadCount}
                 </span>
               )}
             </button>
           );
         })}
      </div>

      <div className="flex-1 min-h-0 relative">
         <AnimatePresence mode="wait">
            {activeTab === 'members' && (
              <motion.div
                key="members"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight text-indigo-700">Project Team</h2>
                    <p className="text-slate-500 font-medium">Collaborators working on this workspace</p>
                  </div>
                  <div className="flex items-center gap-4 px-6 py-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">
                        {Object.values(presence).filter(p => p.presenceStatus === 'online').length} Online
                      </span>
                    </div>
                    <div className="w-[1px] h-4 bg-indigo-200" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      {Array.from(new Set([project.authorId, ...(project.collaborators || [])])).length} Total
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from(new Set([project.authorId, ...(project.collaborators || [])])).map((uid) => {
                    const details = collaboratorDetails[uid] || {};
                    const isAuthor = uid === project.authorId;
                    const pres = presence[uid] || {};
                    const status = pres.presenceStatus || 'offline';
                    const isOnline = status === 'online';
                    const isAway = status === 'away';

                    return (
                      <motion.div
                        key={`member-card-${uid}`}
                        layout
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden"
                      >
                        {/* Status Indicator */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 transition-colors ${isOnline ? 'bg-emerald-500' : isAway ? 'bg-amber-500' : 'bg-slate-100'}`} />
                        
                        <div className="flex items-center gap-5 mb-6">
                          <div className={`relative w-20 h-20 rounded-3xl border-4 transition-all ${isOnline ? 'border-emerald-50 ring-2 ring-emerald-500/20' : isAway ? 'border-amber-50 ring-2 ring-amber-500/20' : 'border-slate-50'}`}>
                            {details.photoURL ? (
                              <img src={details.photoURL} className="w-full h-full rounded-2xl object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-300">
                                <User size={32} />
                              </div>
                            )}
                            {(isOnline || isAway) && (
                              <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'} border-4 border-white rounded-full shadow-lg flex items-center justify-center`}>
                                <div className={`w-1.5 h-1.5 bg-white rounded-full ${isOnline ? 'animate-ping' : ''}`} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-xl font-bold text-slate-900 leading-tight truncate max-w-[150px]">
                                {details.name || details.displayName || 'Member'}
                              </h4>
                              {isAuthor && (
                                <div className="p-1 px-2.5 bg-amber-50 text-amber-600 rounded-lg flex items-center gap-1.5" title="Project Owner">
                                  <ShieldCheck size={14} />
                                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-600">Admin</span>
                                </div>
                              )}
                            </div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              {isAuthor ? 'Project Owner' : 'Collaborator'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                             <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${isOnline ? 'bg-emerald-100 text-emerald-600' : isAway ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                                <Rocket size={14} />
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Current Activity</p>
                                <p className="text-xs font-bold text-slate-700 truncate">
                                  {isOnline || isAway ? (pres.activity || 'Active') : 'Offline'}
                                </p>
                             </div>
                          </div>

                          {pres?.lastSeen && !isOnline && (
                            <div className="flex items-center gap-2 px-1">
                              <Clock size={12} className="text-slate-300" />
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                Last seen {formatDistanceToNow(pres.lastSeen.toMillis())} ago
                                {isAway && <span className="ml-1 text-amber-500 font-black">(Away)</span>}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                               <Mail size={10} />
                             </div>
                             <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">
                               {details.email || 'Email Private'}
                             </span>
                           </div>
                           <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                             <MoreVertical size={16} />
                           </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Invitation Section for Owner */}
                {project.authorId === user.uid && (
                  <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                      <Rocket size={200} />
                    </div>
                    <div className="relative z-10 max-w-xl text-white">
                      <h3 className="text-3xl font-black mb-4 tracking-tight leading-tight">Grow Your Squad.</h3>
                      <p className="text-indigo-100 font-medium text-lg leading-relaxed mb-10 opacity-90">
                        Collaboration is the engine of innovation. Invite more specialists to accelerate your project's development.
                      </p>
                      <button 
                        onClick={() => navigate('/projects')}
                        className="px-10 py-5 bg-white text-indigo-600 font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 ring-4 ring-white/20"
                      >
                        Manage Collaborators <Users size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'board' && (
              <motion.div 
                key="board"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full pb-8"
              >
                 {/* Board Columns simulated here for simplicity with a unified task list or actual columns */}
                 <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                       <form onSubmit={addTask} className="relative group">
                          <Plus size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                          <input 
                            type="text" 
                            value={newTaskTitle}
                            onChange={(e) => {
                               setNewTaskTitle(e.target.value);
                               handleTyping();
                            }}
                            placeholder="Add a priority item... (e.g. Design Wireframes)"
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 font-medium italic placeholder:text-slate-300"
                          />
                       </form>






                       <div className="flex flex-wrap items-center gap-3 px-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Settings:</span>
                          <div className="flex items-center gap-2">
                            {(['low', 'medium', 'high'] as const).map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setNewTaskPriority(p)}
                                className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                  newTaskPriority === p 
                                    ? p === 'high' ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' :
                                      p === 'medium' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' :
                                      'bg-indigo-500 text-white shadow-lg shadow-indigo-100'
                                    : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                          <div className="h-4 w-[1px] bg-slate-200 mx-2" />
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer">
                             <Calendar size={12} className="text-slate-400" />
                             <DatePicker
                               selected={newTaskDueDate}
                               onChange={(date: Date | null) => setNewTaskDueDate(date)}
                               placeholderText="SET DUE DATE"
                               className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest text-slate-600 cursor-pointer w-24"
                               dateFormat="MMM d, yyyy"
                               isClearable
                             />
                          </div>
                          <div className="h-4 w-[1px] bg-slate-200 mx-2" />
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer relative">
                             <User size={12} className="text-slate-400" />
                             <select
                               value={newTaskAssignee?.id || ''}
                               onChange={(e) => {
                                 const uid = e.target.value;
                                 if (!uid) {
                                   setNewTaskAssignee(null);
                                 } else {
                                   setNewTaskAssignee({ id: uid, name: collaboratorDetails[uid]?.name || collaboratorDetails[uid]?.displayName || 'Member' });
                                 }
                               }}
                               className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest text-slate-600 cursor-pointer w-24 appearance-none"
                             >
                               <option value="">Assign To</option>
                               {Object.entries(collaboratorDetails).map(([uid, details]: [string, any]) => (
                                 <option key={uid} value={uid}>{details.name || details.displayName || 'Member'}</option>
                               ))}
                             </select>
                          </div>
                          <button 
                            type="button"
                            onClick={addTask}
                            className="ml-auto px-6 py-1.5 bg-slate-900 text-white text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-black transition-all"
                          >
                             Add Task
                          </button>
                       </div>
                    </div>

                    <div className="space-y-3">
                       {tasks.length === 0 && (
                          <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                             <ListFilter size={32} className="mx-auto text-slate-200 mb-2" />
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active priorities</p>
                          </div>
                       )}
                       {tasks.map(task => (
                          <motion.div 
                            key={task.id}
                            layout
                            animate={{ 
                              opacity: task.status === 'done' ? 0.7 : 1,
                              scale: task.status === 'done' ? 0.98 : 1
                            }}
                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all"
                          >
                             <div className="flex items-center gap-4">
                                <motion.button 
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                    task.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 text-transparent hover:border-indigo-400'
                                  }`}
                                >
                                   <CheckCircle2 size={14} />
                                </motion.button>
                                <div>
                                   <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <div className="relative">
                                         <p className={`font-bold transition-all ${task.status === 'done' ? 'text-slate-300' : 'text-slate-900 group-hover:text-indigo-600'}`}>{task.title}</p>
                                         <AnimatePresence>
                                           {task.status === 'done' && (
                                             <motion.div 
                                               initial={{ width: 0 }}
                                               animate={{ width: '100%' }}
                                               exit={{ width: 0 }}
                                               transition={{ duration: 0.3, ease: 'easeInOut' }}
                                               className="absolute top-[55%] left-0 h-[1.5px] bg-slate-300 rounded-full origin-left"
                                             />
                                           )}
                                         </AnimatePresence>
                                      </div>
                                      <div className="flex items-center gap-1.5 font-bold">
                                         <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${
                                            task.priority === 'high' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                            task.priority === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                            'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                         }`}>
                                            {task.priority}
                                         </span>
                                         {task.assigneeName && (
                                           <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
                                              <User size={10} className="flex-shrink-0" />
                                              <span className="text-[8px] font-bold uppercase tracking-tighter truncate max-w-[80px]">{task.assigneeName}</span>
                                           </div>
                                         )}
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-3">
                                      <span className="text-[9px] font-medium text-slate-300 uppercase tracking-tighter">
                                          Updated {task.createdAt?.toDate ? formatDistanceToNow(task.createdAt.toDate()) : 'recently'} ago
                                      </span>
                                      {task.dueDate && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
                                          <Calendar size={10} />
                                          <span className="text-[9px] font-bold uppercase tracking-tighter">Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                      )}
                                   </div>
                                </div>
                             </div>
                             <div className="flex items-center gap-3">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                   task.status === 'done' ? 'bg-slate-50 text-slate-400' : 'bg-indigo-50 text-indigo-600'
                                }`}>
                                   {task.status}
                                </span>
                                <button 
                                  onClick={() => deleteProjectTask(task.id)}
                                  className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                   <Trash2 size={16} />
                                </button>
                             </div>
                          </motion.div>
                       ))}
                    </div>
                 </div>

                 {/* Side Info */}
                 <div className="space-y-6">
                    <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl shadow-indigo-100">
                       <h3 className="text-lg font-black italic mb-4 flex items-center gap-2">
                          Project Velocity
                          <Rocket size={18} className="text-indigo-400" />
                       </h3>
                       <div className="space-y-6">
                          <div>
                             <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 text-slate-400">
                                <span>Completion</span>
                                <span className="text-indigo-400">
                                  {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%
                                </span>
                             </div>
                             <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner p-0.5">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.status === 'done').length / tasks.length) * 100 : 0}%` }}
                                  className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full" 
                                />
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Items</p>
                                <p className="text-2xl font-black italic text-white">{tasks.length}</p>
                             </div>
                             <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Active</p>
                                <p className="text-2xl font-black italic text-indigo-400">{tasks.filter(t => t.status !== 'done').length}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

            {activeTab === 'notes' && (
              <motion.div 
                key="notes"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                 <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4">Shared Notes</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      onClick={() => setShowNoteModal(true)}
                      className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                       <Plus size={16} /> New Note
                    </button>
                    <button 
                      onClick={handleDriveImport}
                      className="px-6 py-2.5 bg-white border-2 border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-indigo-50 transition-all flex items-center gap-2"
                    >
                       <Share2 size={16} /> Drive Import
                    </button>
                  </div>
                 </div>

                 {notes.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-[2.5rem] border border-slate-200">
                       <div className="w-16 h-16 bg-slate-50 rounded-3xl mx-auto mb-4 flex items-center justify-center text-slate-300">
                          <StickyNote size={32} />
                       </div>
                       <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No shared notes yet</p>
                       <p className="text-xs text-slate-400 mt-2">Create the first note to share with your team.</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                       {notes.map(note => (
                          <motion.div 
                            key={note.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col"
                          >
                             <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                   <FileText size={20} />
                                </div>
                                <button 
                                  onClick={() => deleteNote(note.id)}
                                  className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                   <Trash2 size={16} />
                                </button>
                             </div>
                             <h4 className="text-lg font-bold text-slate-900 mb-3">{note.title}</h4>
                             <p className="text-slate-600 text-sm leading-relaxed mb-6 flex-1 line-clamp-4 whitespace-pre-wrap">{note.content}</p>
                             <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                   By {note.authorName}
                                </span>
                                <span className="text-[9px] font-medium text-slate-300 uppercase tracking-tighter">
                                   {note.createdAt?.toDate ? formatDistanceToNow(note.createdAt.toDate()) : 'Recently'} ago
                                </span>
                             </div>
                          </motion.div>
                       ))}
                    </div>
                 )}
              </motion.div>
            )}

            {activeTab === 'drive' && (
              <motion.div 
                key="drive"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                       Share New Resource
                       <Paperclip size={20} className="text-indigo-600" />
                    </h3>
                    <p className="text-slate-500 text-sm mb-6 -mt-4">Link files, images, or external documentation relevant to the project.</p>
                    <div className="flex flex-col gap-6">
                      <form onSubmit={addResource} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                           <input 
                             required
                             type="text" 
                             placeholder="File name or title..."
                             value={newResourceName}
                             onChange={(e) => {
                                setNewResourceName(e.target.value);
                                handleTyping();
                             }}
                             className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                           />
                        </div>
                        <div className="flex gap-2">
                           <select 
                             value={newResourceType}
                             onChange={(e) => setNewResourceType(e.target.value as any)}
                             className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-[11px] uppercase tracking-widest"
                           >
                              <option value="link">Link</option>
                              <option value="image">Image</option>
                              <option value="file">File</option>
                           </select>
                        </div>
                        <input 
                          required
                          type="url" 
                          placeholder="URL (https://...)"
                          value={newResourceUrl}
                          onChange={(e) => setNewResourceUrl(e.target.value)}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                        <button className="md:col-span-4 py-4 bg-indigo-600 text-white font-bold uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                           Add Resource
                        </button>
                      </form>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-100"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-2 bg-white text-slate-400 font-bold uppercase tracking-widest">or</span>
                        </div>
                      </div>

                      <button 
                        type="button"
                        onClick={handleDriveImport}
                        className="w-full py-4 bg-white border-2 border-indigo-100 text-indigo-600 font-bold uppercase tracking-widest rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center justify-center gap-3"
                      >
                         <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-indigo-500">
                           <path d="M12.5,2L6.2,12.7L2,19.3h12.5l4.3-7.5L12.5,2z" />
                         </svg>
                         Import from Google Drive
                      </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {resources.map(res => (
                       <motion.div 
                         key={res.id}
                         layout
                         onClick={() => setPreviewResource(res)}
                         className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group overflow-hidden h-[220px] flex flex-col justify-between cursor-pointer hover:border-indigo-200 transition-all"
                       >
                          <div>
                             <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center shadow-inner ${
                                res.type === 'image' ? 'bg-amber-50 text-amber-600' :
                                res.type === 'file' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                             }`}>
                                {res.type === 'image' ? <ImageIcon size={24} /> :
                                 res.type === 'file' ? <FileText size={24} /> : <LinkIcon size={24} />}
                             </div>
                             <h4 className="font-bold text-slate-900 mb-1 truncate pr-6">{res.name}</h4>
                             <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter flex items-center gap-1">
                                   <User size={10} className="text-indigo-400" />
                                   {res.uploadedBy}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                   <Clock size={10} />
                                   {res.createdAt?.toDate ? formatDistanceToNow(res.createdAt.toDate()) : 'Recently'} ago
                                </p>
                             </div>
                          </div>

                          <div className="flex items-center justify-between mt-auto">
                             <a 
                               href={res.url} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest hover:underline"
                             >
                                View <ExternalLink size={12} />
                             </a>
                             <button 
                               onClick={() => deleteResource(res.id)}
                               className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0"
                             >
                                <Trash2 size={16} />
                             </button>
                          </div>

                          {/* Details Overlay */}
                          <div className="absolute inset-0 bg-slate-900/95 opacity-0 group-hover:opacity-100 transition-all duration-300 p-6 flex flex-col justify-center items-center text-center translate-y-full group-hover:translate-y-0">
                             {res.type === 'image' ? (
                               <div className="w-full">
                                 <div className="relative w-full h-24 mb-3 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                                   <img 
                                      src={res.url} 
                                      className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" 
                                      referrerPolicy="no-referrer"
                                      alt={res.name}
                                   />
                                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                 </div>
                                 <p className="text-[9px] font-bold text-white uppercase tracking-widest truncate px-2">{res.name}</p>
                                 <p className="text-[7px] text-slate-400 font-bold mt-1 uppercase">Image Resource</p>
                               </div>
                             ) : (
                               <div className="text-white w-full">
                                 <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4 mx-auto border border-indigo-500/30 ring-4 ring-indigo-500/5">
                                   {res.type === 'file' ? <FileText size={20} className="text-indigo-400" /> : <LinkIcon size={20} className="text-indigo-400" />}
                                 </div>
                                 <h5 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2 text-indigo-400">Resource Details</h5>
                                 <p className="text-[8px] text-slate-300 font-medium break-all line-clamp-2 px-4">
                                   {res.url.replace(/^https?:\/\//, '')}
                                 </p>
                               </div>
                             )}
                             
                             <div className="mt-4 pt-4 border-t border-white/10 w-full flex flex-col items-center gap-2">
                               <p className="text-[7px] text-slate-500 font-bold uppercase tracking-tighter">
                                 Added {res.createdAt?.toDate ? formatDistanceToNow(res.createdAt.toDate()) : 'Recently'} ago
                                </p>
                               <div className="flex gap-2">
                                 <button 
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setPreviewResource(res);
                                   }}
                                    className="px-4 py-2 bg-indigo-600 text-white text-[8px] font-bold uppercase tracking-widest rounded-lg hover:bg-indigo-500 transition-all hover:scale-105 active:scale-95"
                                  >
                                    Preview
                                  </button>
                                  <a 
                                    href={res.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-4 py-2 bg-slate-800 text-white text-[8px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-all"
                                  >
                                    Open
                                  </a>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteResource(res.id);
                                    }} 
                                    className="p-2 bg-rose-500/20 text-rose-500 rounded-lg border border-rose-500/30 hover:bg-rose-50 hover:text-white transition-all"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                             </div>
                          </div>
                       </motion.div>
                    ))}
                 </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-[60vh] flex flex-col bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative"
              >
                 {/* Visual Accent */}
                 <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-600" />
                           <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    {messages.length === 0 && (
                       <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                          <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-3xl mb-4 flex items-center justify-center text-slate-300">
                             <MessageSquare size={32} />
                          </div>
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Team Channel</p>
                          <p className="text-xs text-slate-400 font-medium mt-1">Start a discussion with the team.</p>
                       </div>
                    )}
                    {messages.map((msg) => (
                       <div key={`msg-${msg.id}`} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] ${msg.senderId === user.uid ? 'order-2' : ''}`}>
                             <div className={`px-5 py-3.5 rounded-3xl shadow-sm ${
                                msg.senderId === user.uid 
                                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                                  : 'bg-slate-100 text-slate-800 rounded-tl-none'
                             }`}>
                                <p className="text-[10px] font-bold uppercase tracking-tighter mb-1.5 opacity-60">
                                   {msg.senderName} • {msg.createdAt?.toDate ? formatDistanceToNow(msg.createdAt.toDate()) : 'Recently'}
                                </p>
                                <p className="text-sm font-medium leading-relaxed">
                                   {msg.text.split(/(@\w+)/g).map((part, idx) => 
                                      part.startsWith('@') ? (
                                        <span key={idx} className={`font-bold ${msg.senderId === user.uid ? 'text-indigo-200 underline' : 'text-indigo-600'}`}>
                                          {part}
                                        </span>
                                      ) : part
                                   )}
                                </p>
                             </div>
                          </div>
                       </div>
                    ))}
                     {typingUsers.length > 0 && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 italic animate-pulse px-2 pb-2">
                          <span>{typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...</span>
                        </div>
                     )}
                    <div ref={scrollRef} />
                 </div>

                 <form onSubmit={sendChatMessage} className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      placeholder="Type your message..."
                      className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 font-medium"
                    />
                    <button className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
                       <Send size={20} />
                    </button>
                 </form>
              </motion.div>
          )}
       </AnimatePresence>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            key="note-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => setShowNoteModal(false)} 
          />
          <motion.div 
            key="note-content"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative w-full max-w-xl bg-white rounded-[3rem] p-10 shadow-2xl"
          >
            <div className="flex items-center gap-4 mb-8">
               <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <StickyNote size={24} />
               </div>
               <div>
                  <h2 className="text-2xl font-bold text-slate-900 leading-none">New Shared Note</h2>
                  <p className="text-slate-400 text-xs font-medium mt-1">Share ideas, snippets, or project details.</p>
               </div>
            </div>

            <form onSubmit={addNote} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Note Title</label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 font-bold transition-all"
                  placeholder="e.g., Tech Stack Overview"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Content</label>
                <textarea
                  required
                  rows={6}
                  value={newNoteContent}
                  onChange={(e) => {
                    setNewNoteContent(e.target.value);
                    handleTyping();
                  }}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 font-medium transition-all resize-none custom-scrollbar"
                  placeholder="Draft your note here..."
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-indigo-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Share to Workspace
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Resource Preview Modal */}
      <AnimatePresence>
        {previewResource && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              key="preview-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" 
              onClick={() => setPreviewResource(null)} 
            />
            <motion.div 
              key="preview-content"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl h-full max-h-[85vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    previewResource.type === 'image' ? 'bg-amber-50 text-amber-600' :
                    previewResource.type === 'file' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {previewResource.type === 'image' ? <ImageIcon size={20} /> :
                     previewResource.type === 'file' ? <FileText size={20} /> : <LinkIcon size={20} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 truncate max-w-md">{previewResource.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Shared by {previewResource.uploadedBy} • {previewResource.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a 
                    href={previewResource.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-black transition-all shadow-lg"
                  >
                    Open Original <ExternalLink size={14} />
                  </a>
                  <button 
                    onClick={() => setPreviewResource(null)}
                    className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-900"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 bg-slate-50 relative overflow-hidden flex items-center justify-center p-8">
                {previewResource.type === 'image' ? (
                  <img 
                    src={previewResource.url} 
                    alt={previewResource.name}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (previewResource.url.toLowerCase().endsWith('.pdf') || previewResource.url.includes('docs.google.com') || previewResource.url.includes('notion.site')) ? (
                  <iframe 
                    src={previewResource.url} 
                    className="w-full h-full rounded-xl border border-slate-200 bg-white"
                    title={previewResource.name}
                  />
                ) : (
                  <div className="text-center p-12 max-w-lg">
                    <div className="w-20 h-20 bg-white rounded-3xl mx-auto mb-6 flex items-center justify-center text-slate-200 shadow-sm border border-slate-100">
                      <FileText size={40} />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Extended Preview Unavailable</h4>
                    <p className="text-slate-500 font-medium mb-8">
                      This file format cannot be previewed directly in the workspace. Please use the button below to open it in a new tab.
                    </p>
                    <a 
                      href={previewResource.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-8 py-4 bg-indigo-600 text-white font-bold uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all inline-block"
                    >
                      Open in New Tab
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
