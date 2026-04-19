import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.tsx';
import { db, handleFirestoreError } from '../lib/firebase.ts';
import { 
  doc, getDoc, collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, deleteDoc, serverTimestamp, 
  where 
} from 'firebase/firestore';
import { 
  Rocket, Users, ListFilter, Plus, CheckCircle2, 
  Paperclip, Image as ImageIcon, Link as LinkIcon, 
  MessageSquare, Send, ArrowLeft, MoreVertical, 
  Clock, AlertCircle, FileText, ExternalLink, Trash2,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

type Task = {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
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

export default function Workspace() {
  const { id } = useParams();
  const { user } = useAuth()!;
  const navigate = useNavigate();
  
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'board' | 'drive' | 'chat'>('board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [newResourceType, setNewResourceType] = useState<'file' | 'image' | 'link'>('link');
  const [newMessage, setNewMessage] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;
    fetchProject();
  }, [id, user]);

  const fetchProject = async () => {
    try {
      const docRef = doc(db, 'posts', id!);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        setError('Project not found');
        return;
      }
      const data = docSnap.data();
      const isMember = data.authorId === user.uid || data.collaborators?.includes(user.uid);
      if (!isMember) {
        setError('Unauthorized access to this workspace');
        return;
      }
      setProject({ id: docSnap.id, ...data });
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

    const qChat = query(collection(db, 'rooms', `proj_${id}`, 'messages'), orderBy('createdAt', 'asc'));
    const unsubChat = onSnapshot(qChat, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      handleFirestoreError(err, 'list', `rooms/proj_${id}/messages`);
    });

    return () => {
      unsubTasks();
      unsubDrive();
      unsubChat();
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
        priority: 'medium',
        createdAt: serverTimestamp()
      });
      setNewTaskTitle('');
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

  const deleteResource = async (resId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', id!, 'resources', resId));
    } catch (e) {
      handleFirestoreError(e, 'delete', `posts/${id}/resources/${resId}`);
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, 'rooms', `proj_${id}`, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName,
        text: newMessage,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (e) {
      handleFirestoreError(e, 'create', `rooms/proj_${id}/messages`);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
       <Rocket className="animate-bounce text-indigo-600 mr-2" />
       <span className="font-black text-slate-400 uppercase tracking-widest italic">Synchronizing Workspace...</span>
    </div>
  );

  if (error) return (
    <div className="p-12 text-center max-w-md mx-auto">
       <AlertCircle size={48} className="text-rose-500 mx-auto mb-4" />
       <h1 className="text-2xl font-black text-slate-900 mb-2 italic">Mission Aborted</h1>
       <p className="text-slate-500 mb-6 font-medium">{error}</p>
       <button onClick={() => navigate('/projects')} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">
          Back to Hub
       </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col font-sans">
      {/* Workspace Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div className="flex items-center gap-4">
           <button onClick={() => navigate('/projects')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <ArrowLeft size={20} />
           </button>
           <div>
              <div className="flex items-center gap-2 mb-1">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Active Workspace</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none italic">{project.title}</h1>
           </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex -space-x-2 mr-4">
              {[project.authorName, ...(project.collaborators || [])].slice(0, 4).map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 ring-2 ring-slate-50">
                  <User size={12} />
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-600 flex items-center justify-center text-[8px] font-black text-white ring-2 ring-indigo-50">
                +{(project.collaborators?.length || 0) + 1}
              </div>
           </div>
           <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 shadow-sm transition-all hover:border-slate-300">
              <MoreVertical size={20} />
           </button>
        </div>
      </header>

      {/* Workspace Navigation */}
      <div className="flex gap-1 bg-slate-100 p-1.5 rounded-[1.25rem] w-fit mb-8 shadow-inner border border-slate-200/50">
         {[
           { id: 'board', name: 'Priorities', icon: ListFilter },
           { id: 'drive', name: 'Resource Drive', icon: Paperclip },
           { id: 'chat', name: 'Secure Chat', icon: MessageSquare }
         ].map((tab) => (
           <button
             key={tab.id}
             onClick={() => setActiveTab(tab.id as any)}
             className={`flex items-center gap-2 px-6 py-2.5 rounded-[0.9rem] text-xs font-black uppercase tracking-widest transition-all ${
               activeTab === tab.id 
                 ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5' 
                 : 'text-slate-400 hover:text-slate-600'
             }`}
           >
             <tab.icon size={14} />
             {tab.name}
           </button>
         ))}
      </div>

      <div className="flex-1 min-h-0 relative">
         <AnimatePresence mode="wait">
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
                    <form onSubmit={addTask} className="relative group">
                       <Plus size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                       <input 
                         type="text" 
                         value={newTaskTitle}
                         onChange={(e) => setNewTaskTitle(e.target.value)}
                         placeholder="Add a priority item... (e.g. Design Wireframes)"
                         className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-indigo-50 font-medium italic placeholder:text-slate-300"
                       />
                    </form>

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
                            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all"
                          >
                             <div className="flex items-center gap-4">
                                <button 
                                  onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                    task.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 text-transparent hover:border-indigo-400'
                                  }`}
                                >
                                   <CheckCircle2 size={14} />
                                </button>
                                <div>
                                   <p className={`font-bold transition-all ${task.status === 'done' ? 'text-slate-300 line-through italic' : 'text-slate-900 group-hover:text-indigo-600'}`}>{task.title}</p>
                                   <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                                      Modified {task.createdAt?.toDate ? formatDistanceToNow(task.createdAt.toDate()) : 'Now'} ago
                                   </span>
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

            {activeTab === 'drive' && (
              <motion.div 
                key="drive"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-black italic text-slate-900 mb-6 flex items-center gap-2">
                       Add Resource
                       <Paperclip size={20} className="text-indigo-600" />
                    </h3>
                    <form onSubmit={addResource} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div className="md:col-span-2">
                          <input 
                            required
                            type="text" 
                            placeholder="Resource Name (e.g. Design Prototype)"
                            value={newResourceName}
                            onChange={(e) => setNewResourceName(e.target.value)}
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold italic"
                          />
                       </div>
                       <div className="flex gap-2">
                          <select 
                            value={newResourceType}
                            onChange={(e) => setNewResourceType(e.target.value as any)}
                            className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-black text-[11px] uppercase tracking-widest"
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
                         className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold italic"
                       />
                       <button className="md:col-span-4 py-4 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all italic">
                          Share with Team
                       </button>
                    </form>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {resources.map(res => (
                       <motion.div 
                         key={res.id}
                         layout
                         className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group overflow-hidden"
                       >
                          <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center shadow-inner ${
                             res.type === 'image' ? 'bg-amber-50 text-amber-600' :
                             res.type === 'file' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                             {res.type === 'image' ? <ImageIcon size={24} /> :
                              res.type === 'file' ? <FileText size={24} /> : <LinkIcon size={24} />}
                          </div>
                          <h4 className="font-black text-slate-900 italic mb-1 truncate pr-6">{res.name}</h4>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-4">
                             Shared by {res.uploadedBy}
                          </p>
                          <div className="flex items-center justify-between">
                             <a 
                               href={res.url} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline"
                             >
                                Open <ExternalLink size={12} />
                             </a>
                             <button 
                               onClick={() => deleteResource(res.id)}
                               className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0"
                             >
                                <Trash2 size={16} />
                             </button>
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
                          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">End-to-End Encrypted Team Channel</p>
                          <p className="text-xs text-slate-400 font-medium mt-1 italic">Start the mission discussion here.</p>
                       </div>
                    )}
                    {messages.map(msg => (
                       <div key={msg.id} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] ${msg.senderId === user.uid ? 'order-2' : ''}`}>
                             <div className={`px-5 py-3.5 rounded-3xl shadow-sm ${
                               msg.senderId === user.uid 
                                 ? 'bg-indigo-600 text-white rounded-tr-none' 
                                 : 'bg-slate-100 text-slate-800 rounded-tl-none'
                             }`}>
                                <p className="text-[10px] font-black uppercase tracking-tighter mb-1.5 opacity-60">
                                   {msg.senderName} • {msg.createdAt?.toDate ? formatDistanceToNow(msg.createdAt.toDate()) : 'Now'}
                                </p>
                                <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                             </div>
                          </div>
                       </div>
                    ))}
                    <div ref={scrollRef} />
                 </div>

                 <form onSubmit={sendChatMessage} className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Transmission command... @team"
                      className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 font-medium italic"
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
    </div>
  );
}
