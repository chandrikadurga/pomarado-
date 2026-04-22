# PomaradoOS - Personal Productivity Operating System

*Designed & Developed by Chandrika Durga*

## 🚀 Overview

**PomaradoOS** is a comprehensive, multi-page personal cloud-synchronized productivity system. Built initially as a Pomodoro dashboard, it has evolved into a fully-fledged operating system for tracking tasks, projects, academic milestones, and daily health goals (sleep and hydration).

I accelerated the development of this full-stack application by combining my own custom UI/UX design skills from **Figma** with **Advanced AI Prompt Engineering** techniques to rapidly architect and iterate the codebase:

### ✨ Engineering & Design Methodology

- **UI/UX Design (Figma):** Cultivated a highly premium, modern light aesthetic. Instead of standard flat UI, I designed and mandated a custom aesthetic utilizing "glassmorphism" shadow blending, vibrant coral/blue gradient accents, and spatial fluidity.
- **Chain of Thought (CoT) Prompting:** To coordinate the complex multi-module integration (Dashboard, Projects, Health, Subjects), I commanded the AI using step-by-step logic. I laid out the sequential execution of frontend routing, database schema definitions, and module injection before allowing the AI to generate code.
- **Few-Shot Prompting:** To maintain absolute structural integrity across the existing codebase, I utilized few-shot prompting techniques. I provided the AI with strict examples of how the existing `AppDB` wrappers and vanilla JS events were structured, ensuring all injected multi-page features (`projects.js`, `subjects.js`, etc.) flawlessly matched my architecture natively.

---

## 🛠 Features

- **Pomodoro Focus Timer** (Custom settings, alarms, streaks)
- **Project & Startup Tracker** (Progress bars, milestone checklists)
- **Academic Subject Tracker** (Chapter/unit completion logic)
- **Health OS** (Water goal tracking and sleep duration logs)
- **Cloud Sync** (Powered by Supabase and Row Level Security)
- **SPA Router** (Fast, native Vanilla JS Single Page Application module switching)

---

## ⚙️ Backend Setup (Supabase)

### 1) Configure Keys

Edit `db.js` and input your variables:
```javascript
const config = {
    supabaseUrl: "https://YOUR_PROJECT_ID.supabase.co",
    supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

### 2) Database Schema & Security

To enable all the tracking and dashboard features, open your Supabase SQL Editor and run the provided SQL definitions in your `supabase_setup.sql` file.

This establishes all necessary tables (`user_stats`, `tasks`, `profiles`, `projects`, `milestones`, `subjects`, `health_logs`) and enforces strict **Row Level Security (RLS)** ensuring every user's data is isolated and safely restricted only to their `auth.uid()`.

### 3) Run Locally

Because this is purely built in Vanilla JS, HTML, and CSS, simply open `index.html` in your browser or run it via a Live Server extension. Log in or create an account to start syncing data to your cloud!
