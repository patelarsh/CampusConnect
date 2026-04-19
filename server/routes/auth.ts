import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.ts';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET || 'supersecretkey');
    res.status(201).json({ token, user: { id: newUser._id, name, email } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'supersecretkey');
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', async (req: any, res) => {
    // In a real app, use authMiddleware before this
    // This is just a placeholder
    res.json({ message: "Working" });
});

export default router;
