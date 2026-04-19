import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase.ts';
import { collection, getDocs } from 'firebase/firestore';
import { BookOpen, Search, Download, Plus, FileText, User } from 'lucide-react';
import { motion } from 'motion/react';

const SUBJECTS = ['All Subjects', 'Computer Science', 'Mathematics', 'Physics', 'Management', 'Economics'];

export default function Notes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [filter, setFilter] = useState('All Subjects');

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const snap = await getDocs(collection(db, 'notes'));
      setNotes(snap.docs.map(doc => ({ _id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
    }
  };

  const filteredNotes = filter === 'All Subjects' 
    ? notes 
    : notes.filter(n => n.subject === filter);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Notes Sharing</h1>
          <p className="text-slate-500">Access high-quality study resources shared by peers.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-3 bg-fuchsia-600 text-white font-bold rounded-xl shadow-lg shadow-fuchsia-200 hover:bg-fuchsia-700 transition-all self-start">
          <Plus size={20} />
          Upload Notes
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search for notes, topics, or subjects..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
           {SUBJECTS.map(s => (
             <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  filter === s 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
             >
               {s}
             </button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotes.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
              <BookOpen size={32} />
            </div>
            <p className="text-slate-500 font-medium">No notes found for this subject yet.</p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <motion.div
              key={note._id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-md transition-shadow flex flex-col shadow-sm"
            >
              <div className="p-6 pb-0 flex items-start justify-between">
                <div className="w-12 h-12 bg-fuchsia-50 text-fuchsia-600 rounded-2xl flex items-center justify-center">
                  <FileText size={24} />
                </div>
                <button className="text-slate-300 hover:text-slate-900 transition-colors">
                  <Download size={20} />
                </button>
              </div>
              
              <div className="p-6">
                <span className="text-[10px] font-bold text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-2 py-1 rounded-md mb-3 inline-block">
                  {note.subject}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mb-2 truncate">{note.title}</h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-6">{note.description}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                   <div className="flex items-center gap-2">
                     <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold">
                       {note.author?.name?.charAt(0) || <User size={12} />}
                     </div>
                     <span className="text-xs font-semibold text-slate-500">{note.author?.name || 'Anonymous'}</span>
                   </div>
                   <button className="text-xs font-bold text-indigo-600 hover:underline">View File</button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
