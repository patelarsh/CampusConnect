<div align="center">

# 🎓 CampusConnect

**The all-in-one platform for students to find project partners, share notes, and solve doubts — all within their campus.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://campuspace.patelarsh.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-99.5%25-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)

</div>

---

## 📖 About

CampusConnect (also known as **CampusSpace**) is a responsive web platform built for college students. It brings your entire campus community together — making it easy to collaborate on projects, exchange study materials, and get real-time answers to your doubts, all within your campus network.

---

## ✨ Features

- 🤝 **Find Project Partners** — Connect with fellow students who share your interests and skills
- 📝 **Share Notes** — Upload, browse, and download study materials across subjects
- 💬 **Solve Doubts in Real-time** — Ask questions and get answers from your campus community instantly
- 🔐 **Secure Authentication** — Login & signup powered by Firebase Auth
- 📅 **Event Scheduling** — Track and manage campus events with a built-in date picker
- 📍 **Location & Media Aware** — Supports camera, microphone, and geolocation for richer interactions
- 🎨 **Modern UI** — Clean, responsive design with Tailwind CSS and smooth animations via Framer Motion

---

## 🛠️ Tech Stack

| Layer      | Technology                                  |
|------------|---------------------------------------------|
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend    | Express.js, Node.js, TSX                    |
| Database   | Firebase Firestore                          |
| Auth       | Firebase Authentication                     |
| Animations | Framer Motion (`motion`)                    |
| Routing    | React Router DOM v7                         |
| Deployment | Vercel                                      |

---

## 📦 Getting Started

### Prerequisites

- **Node.js** v18+
- A **Firebase project** with Firestore and Authentication enabled

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

Open `.env.local` and fill in your Firebase credentials:

```env
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

The app will be available at `http://localhost:5173`.

---

## 📜 Available Scripts

| Command           | Description                        |
|-------------------|------------------------------------|
| `npm run dev`     | Start the development server       |
| `npm run build`   | Build for production               |
| `npm run preview` | Preview the production build       |
| `npm run lint`    | Type-check with TypeScript         |
| `npm run clean`   | Remove the `dist` folder           |

---

## 🔥 Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project
2. Enable **Firestore Database** and **Authentication** (Email/Password)
3. Copy your config values into `.env.local`
4. Deploy security rules:

```bash
firebase deploy --only firestore:rules
```

---

## 🌍 Deployment

Deployed on **Vercel**. To deploy your own instance:

```bash
npm i -g vercel
vercel
```

Add all environment variables in your Vercel project dashboard under **Settings → Environment Variables**.

---

## 📁 Project Structure

```
CampusConnect/
├── src/                      # React frontend source
├── server.ts                 # Express backend server
├── index.html                # HTML entry point
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config
├── firebase-blueprint.json   # Firebase project config
├── firestore.rules           # Firestore security rules
├── metadata.json             # App metadata & permissions
├── .env.example              # Environment variable template
└── package.json
```

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create your branch: `git checkout -b feature/your-feature`
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
