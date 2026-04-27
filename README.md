<div align="center">

# 🎓 CampusConnect

**An AI-powered campus companion built for college students.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-campus--connect--phi--three.vercel.app-blue?style=for-the-badge&logo=vercel)](https://campus-connect-phi-three.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-99.5%25-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini-AI-8E75B2?style=for-the-badge&logo=google)](https://ai.google.dev/)

</div>

---

## ✨ Overview

CampusConnect is a full-stack web application designed to help college students stay organized, connected, and informed — powered by Google Gemini AI. Whether it's tracking events, managing tasks, or getting instant answers, CampusConnect brings everything campus-related into one place.

---

## 🚀 Features

- 🤖 **AI Assistant** — Gemini-powered chat for campus queries and productivity
- 🔐 **Authentication** — Secure login & sign-up via Firebase Auth
- 🗃️ **Real-time Database** — Live data sync with Firestore
- 📅 **Date Management** — Schedule and track campus events with a date picker
- 🌐 **Routing** — Smooth multi-page navigation with React Router v7
- 🎨 **Modern UI** — Styled with Tailwind CSS v4 + Framer Motion animations
- ⚡ **Fast Dev Experience** — Vite + Express backend with TypeScript throughout

---

## 🛠️ Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS v4     |
| Backend    | Express.js, Node.js, TSX                        |
| Database   | Firebase Firestore                              |
| Auth       | Firebase Authentication                         |
| AI         | Google Gemini (`@google/genai`)                 |
| Animations | Framer Motion (`motion`)                        |
| Routing    | React Router DOM v7                             |
| Deployment | Vercel                                          |

---

## 📦 Getting Started

### Prerequisites

- **Node.js** v18+ installed
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)
- A **Firebase project** with Firestore enabled

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/patelarsh/CampusConnect.git
cd CampusConnect

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Open `.env.local` and fill in your credentials:

```env
GEMINI_API_KEY=your_gemini_api_key_here
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Run Locally

```bash
npm run dev
```

The app will start on `http://localhost:5173` (or the port configured in `server.ts`).

---

## 📜 Available Scripts

| Command         | Description                          |
|-----------------|--------------------------------------|
| `npm run dev`   | Start the development server         |
| `npm run build` | Build for production                 |
| `npm run preview` | Preview the production build       |
| `npm run lint`  | Type-check with TypeScript           |
| `npm run clean` | Remove the `dist` folder             |

---

## 🔥 Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Firestore** and **Authentication** (Email/Password)
3. Copy your Firebase config into `.env.local`
4. Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

---

## 🌍 Deployment

This project is deployed on **Vercel**. To deploy your own:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Make sure to add all environment variables in your Vercel project settings.

---

## 📁 Project Structure

```
CampusConnect/
├── src/                    # React frontend source
├── server.ts               # Express backend server
├── index.html              # HTML entry point
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript config
├── firebase-blueprint.json # Firebase project config
├── firestore.rules         # Firestore security rules
├── .env.example            # Environment variable template
└── package.json
```

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

Made with ❤️ by [Arsh Patel](https://github.com/patelarsh)

⭐ Star this repo if you found it helpful!

</div>
