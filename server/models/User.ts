import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  semester: { type: String },
  skills: { type: [String], default: [] },
  bio: { type: String },
  profilePicture: { type: String },
  joinedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
