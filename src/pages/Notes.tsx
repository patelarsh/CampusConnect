import React, { useState, useEffect } from 'react';
import { db, storage, handleFirestoreError } from '../lib/firebase.ts';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { BookOpen, Search, Download, Plus, FileText, User, ShieldCheck, School, Upload, Image as ImageIcon, X, File, RotateCcw, Sparkles, Loader2, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App.tsx';
import { uploadToDrive, hasDriveAccess, requestDriveAccess } from '../lib/googleDrive.ts';
import { generateText } from '../lib/gemini.ts';

const SUBJECTS = ['All Subjects', 'Computer Science', 'Mathematics', 'Physics', 'Management', 'Economics'];

export default function Notes() {
  const { user } = useAuth()!;
  const [notes, setNotes] = useState<any[]>([]);
  const [filter, setFilter] = useState('All Subjects');
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [useDrive, setUseDrive] = useState(false);
  const [isDriveDisabled, setIsDriveDisabled] = useState(false);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const canUseDrive = hasDriveAccess() && !isDriveDisabled;

  const handleSummarize = async (note: any) => {
    setSummarizingId(note._id);
    try {
      const prompt = `Summarize these study notes for me. 
        Title: ${note.title}
        Subject: ${note.subject}
        Description: ${note.description}
        Keep it as a short, bulleted list of potential topics covered.`;
      
      const result = await generateText(prompt);
      setSummaries(prev => ({ ...prev, [note._id]: result }));
    } catch (e) {
      console.error("AI Summary failed:", e);
      alert("Failed to generate summary.");
    } finally {
      setSummarizingId(null);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (userProfile) {
      fetchNotes();
    }
  }, [userProfile]);

  const fetchUserProfile = async () => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        setUserProfile(snap.data());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotes = async () => {
    if (!userProfile?.collegeName) return;
    try {
      const q = query(collection(db, 'notes'), where('collegeName', '==', userProfile.collegeName));
      const snap = await getDocs(q);
      setNotes(snap.docs.map(doc => ({ _id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [showModal, setShowModal] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', description: '', subject: 'Computer Science' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleConnectDrive = async () => {
    try {
      await requestDriveAccess();
      setUseDrive(true);
      setUploadError(null);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to connect Google Drive.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !newNote.title) return;
    
    setUploading(true);
    setUploadError(null);
    try {
      if (!userProfile?.collegeName) {
        throw new Error('User profile not loaded. Please finish onboarding.');
      }

      let fileUrl = '';
      let storageType = 'firebase';

      if (selectedFile) {
        let driveUploadSuccess = false;
        if (useDrive && canUseDrive) {
          try {
            fileUrl = await uploadToDrive(selectedFile);
            storageType = 'google-drive';
            driveUploadSuccess = true;
          } catch (driveErr: any) {
            const isDisabled = driveErr.message?.toLowerCase().includes('disabled');
            
            if (isDisabled) {
               console.warn("GDrive API is disabled, falling back to standard storage.");
               setIsDriveDisabled(true);
               setUseDrive(false);
            } else {
               console.error("GDrive upload failed, falling back to Firebase", driveErr);
            }
          }
        }

        // Fallback to Firebase if Drive failed or wasn't used
        if (!driveUploadSuccess) {
          const fileRef = ref(storage, `notes/${user.uid}/${Date.now()}_${selectedFile.name}`);
          const uploadResult = await uploadBytes(fileRef, selectedFile);
          fileUrl = await getDownloadURL(uploadResult.ref);
          storageType = 'firebase';
        }
      }

      await addDoc(collection(db, 'notes'), {
        ...newNote,
        fileUrl,
        storageType,
        fileName: selectedFile?.name || '',
        fileType: selectedFile?.type || '',
        authorId: user.uid,
        authorName: user.displayName || 'Student',
        author: {
          id: user.uid,
          name: user.displayName || 'Student'
        },
        collegeName: userProfile.collegeName,
        createdAt: serverTimestamp()
      });
      setShowModal(false);
      setNewNote({ title: '', description: '', subject: 'Computer Science' });
      setSelectedFile(null);
      setFilePreview(null);
      fetchNotes();
    } catch (err: any) {
      console.error("Full upload process failed:", err);
      if (err.code === 'storage/retry-limit-exceeded') {
        setUploadError("The upload timed out. Please ensure 'Firebase Storage' is enabled in your Firebase Console.");
      } else {
        setUploadError(err.message || "An error occurred during upload.");
      }
      handleFirestoreError(err, 'create', 'notes');
    } finally {
      setUploading(false);
    }
  };

  const filteredNotes = notes.filter(n => {
    const matchesSubject = filter === 'All Subjects' || n.subject === filter;
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         n.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Notes Sharing</h1>
          <p className="text-slate-500">Access high-quality study resources shared by peers.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-fuchsia-600 text-white font-bold rounded-xl shadow-lg shadow-fuchsia-200 hover:bg-fuchsia-700 transition-all self-start"
        >
          <Plus size={20} />
          Upload Notes
        </button>
      </header>
      
      {/* College Banner */}
      <div className="p-4 bg-fuchsia-50 border border-fuchsia-100 rounded-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-fuchsia-100 flex items-center justify-center text-fuchsia-600">
            <School size={18} />
          </div>
          <p className="text-sm text-fuchsia-900 font-medium">
            Campus specific notes for <span className="font-bold">{userProfile?.collegeName}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
              key={`note-${note._id}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-md transition-shadow flex flex-col shadow-sm"
            >
              <div className="p-6 pb-0 flex items-start justify-between">
                <div className="w-12 h-12 bg-fuchsia-50 text-fuchsia-600 rounded-2xl flex items-center justify-center">
                  <FileText size={24} />
                </div>
                {note.fileUrl && (
                  <a 
                    href={note.fileUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-slate-300 hover:text-indigo-600 transition-colors"
                  >
                    <Download size={20} />
                  </a>
                )}
              </div>
              
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-2 truncate">{note.title}</h3>
                <div className="flex items-center gap-2 mb-2">
                   <span className="text-[10px] font-bold text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-2 py-1 rounded-md">
                    {note.subject}
                  </span>
                  {note.storageType === 'google-drive' && (
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md flex items-center gap-1">
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current">
                        <path d="M12.5,2L6.2,12.7L2,19.3h12.5l4.3-7.5L12.5,2z" />
                      </svg>
                      Drive
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4">{note.description}</p>

                {summaries[note._id] ? (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs text-indigo-700 font-medium"
                  >
                    <p className="font-bold mb-1 flex items-center gap-1.5 uppercase tracking-widest text-[9px]">
                      <Sparkles size={10} /> AI Topic Summary
                    </p>
                    <div className="whitespace-pre-wrap">{summaries[note._id]}</div>
                  </motion.div>
                ) : (
                  <button 
                    onClick={() => handleSummarize(note)}
                    disabled={summarizingId === note._id}
                    className="mb-6 flex items-center gap-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-widest"
                  >
                    {summarizingId === note._id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    Generate AI summary
                  </button>
                )}

                {note.fileType?.startsWith('image/') && note.fileUrl && (
                  <div className="mb-6 rounded-xl overflow-hidden aspect-video bg-slate-50 border border-slate-100">
                    <img 
                      src={note.fileUrl} 
                      alt={note.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                   <div className="flex items-center gap-2">
                     <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold">
                       {note.author?.name?.charAt(0) || <User size={12} />}
                     </div>
                     <span className="text-xs font-semibold text-slate-500">{note.author?.name || 'Anonymous'}</span>
                   </div>
                   {note.fileUrl ? (
                     <a 
                       href={note.fileUrl} 
                       target="_blank" 
                       rel="noreferrer"
                       className="text-xs font-bold text-indigo-600 hover:underline"
                     >
                        View {note.fileType?.startsWith('image/') ? 'Image' : 'File'}
                     </a>
                   ) : (
                     <span className="text-xs font-bold text-slate-300 italic">No attachment</span>
                   )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Note Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Share Study Notes</h2>
            
            {uploadError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-medium">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Note Title</label>
                <input
                  type="text"
                  required
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-fuchsia-500"
                  placeholder="e.g. OS Memory Management"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                <textarea
                  required
                  rows={3}
                  value={newNote.description}
                  onChange={(e) => setNewNote({ ...newNote, description: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none"
                  placeholder="Briefly describe what these notes cover..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subject</label>
                <select
                  value={newNote.subject}
                  onChange={(e) => setNewNote({ ...newNote, subject: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-fuchsia-500 font-bold"
                >
                  {SUBJECTS.filter(s => s !== 'All Subjects').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Resource File</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Image or PDF preferred</span>
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  {!selectedFile ? (
                    <label 
                      htmlFor="file-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl hover:border-fuchsia-300 hover:bg-fuchsia-50/50 transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-fuchsia-500 mb-2 transition-colors">
                        <Upload size={20} />
                      </div>
                      <p className="text-xs font-bold text-slate-500 group-hover:text-fuchsia-600">Click to upload from gallery</p>
                      <p className="text-[10px] text-slate-400 mt-1">Max 5MB recommended</p>
                    </label>
                  ) : (
                    <div className="relative group overflow-hidden rounded-2xl border border-slate-200">
                      {filePreview ? (
                        <div className="relative aspect-video w-full">
                          <img 
                            src={filePreview} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label htmlFor="file-upload" className="px-4 py-2 bg-white/90 backdrop-blur text-xs font-bold rounded-lg cursor-pointer hover:bg-white transition-colors">
                              Change Image
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 p-4 bg-slate-50">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <File size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{selectedFile.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <label htmlFor="file-upload" className="p-2 text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors">
                            <Search size={16} />
                          </label>
                        </div>
                      )}
                      <button 
                         type="button"
                         onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                         className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-rose-500 text-white rounded-full transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Google Drive Toggle */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${hasDriveAccess() ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M12.5,2L6.2,12.7L2,19.3h12.5l4.3-7.5L12.5,2z M8.1,12.7l4.4-7.6l2.1,3.7l-4.4,7.6L8.1,12.7z M14.1,18.4L14.1,18.4l-4.3,0 l2.1-3.7l4.3,0L14.1,18.4z M17,17.2l-2.1,0l2.1-3.7l2.1,3.7h-2.1V17.2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Google Drive Storage</p>
                    <p className={`text-[10px] font-medium ${isDriveDisabled ? 'text-amber-600' : 'text-slate-400'}`}>
                      {isDriveDisabled 
                        ? 'Google Drive API is disabled. Falling back to default storage.' 
                        : hasDriveAccess()
                           ? 'Store directly in your Google Drive' 
                           : 'Connect your Drive to save storage'
                      }
                    </p>
                  </div>
                </div>
                {hasDriveAccess() ? (
                  <button
                    type="button"
                    disabled={isDriveDisabled}
                    onClick={() => setUseDrive(!useDrive)}
                    className={`w-12 h-6 rounded-full transition-all relative ${useDrive ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${useDrive ? 'right-1' : 'left-1'}`} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectDrive}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-3 bg-fuchsia-600 text-white font-bold rounded-xl shadow-xl shadow-fuchsia-100 hover:bg-fuchsia-700 transition-all disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Share Notes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
