import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [{
    text: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  }],
  tags: [{ type: String }],
}, { timestamps: true });

export const Question = mongoose.model('Question', questionSchema);
