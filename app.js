// Firebase Imports
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { 
            getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
            signOut, updateProfile, setPersistence, browserLocalPersistence 
        } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { 
            getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, 
            addDoc, query, orderBy, onSnapshot, updateDoc, arrayUnion, arrayRemove, increment
        } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // ===== 1) Firebase & App State Initialization =====
        const appRoot = document.getElementById('app-root');
        let app, db, auth;
        let user = null;
        let profile = null;
        let todayMood = null;
        let calendarMap = {};
        let chartData = [];
        let chatMessages = [];
        let chatUnsubscribe = null;
        let isDarkMode = true; // Default to dark mode
        
        const musicPlaylist = Array.from({length: 20}, (_, i) => `music${i + 1}.mp3`);
        let shuffledPlaylist = [];
        let currentTrackIndex = 0;
        let isShuffled = true;
        const audio = new Audio();


        // User's Firebase Configuration
        const firebaseConfig = {
          apiKey: "AIzaSyAbEOtxeAdvh-ZwXCbhH9VQDzWENx8FGB8",
          authDomain: "secret-whisper29.firebaseapp.com",
          projectId: "secret-whisper29",
          storageBucket: "secret-whisper29.firebasestorage.app",
          messagingSenderId: "430580076855",
          appId: "1:430580076855:web:78f1a095e18df3fa178ab2",
          measurementId: "G-WXJG06XQ2Y"
        };
        
        const appId = "default-app-id"; 

        // ===== 2) Helpers & Constants =====
        const MOODS = [
          { score: -2, label: "Very Sad", emoji: "🥀", color: "#ef4444" },
          { score: -1, label: "Sad", emoji: "🌧️", color: "#f97316" },
          { score: 0, label: "Neutral", emoji: "🌤️", color: "#eab308" },
          { score: 1, label: "Happy", emoji: "🌈", color: "#22c55e" },
          { score: 2, label: "Very Happy", emoji: "✨", color: "#8b5cf6" },
        ];

        const COUNSELORS = [
            { name: "Vaibhav Sharma", degree: "M.Phil, Clinical Psychology", experience: "8+ Years", whatsapp: "918837622913" },
            { name: "Madhav Kumar", degree: "M.Sc, Counseling Psychology", experience: "6+ Years", whatsapp: "918630044552" },
            { name: "Rahul Sharma", degree: "MA, Psychology", experience: "5+ Years", whatsapp: "917500683911" },
        ];
        
        const MOTIVATIONAL_VIDEOS = ['dQw4w9WgXcQ', '3sK3wJAxGfs', 'mgmVOuLgFB0', 'I22gsk_Gj84', 'ZXsQAXx_ao0', 'g-jwWYX7Jlo', '6P2nPI6CTlc', 'ZXsQAXx_ao0', 'unxxS3ddI1c', 'k9zTr2MAi0g', 'GwzN5YknM3U', 'cPa_K_s2g24', 'z9bZufPH12A', 'Z21sEOF_2oI', '5MgBikgcWnY'];
        
        const GREETINGS = (name) => {
            const lines = [
                `Hello ${name}, ready to make today amazing? ✨`,
                `Welcome back, ${name}! What's on your mind today?`,
                `Hey ${name}, let's check in and see how you're doing.`,
                `Glad to see you, ${name}! Remember, every day is a fresh start.`,
                `Hi ${name}! Wanna share something? I'm all ears. 🎧`
            ];
            return lines[Math.floor(Math.random() * lines.length)];
        };


        function titleCase(s) {
          if (!s) return "";
          return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
        }
        function dateId(d = new Date()) {
          const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
          return tz.toISOString().slice(0, 10);
        }

        // ===== 3) Gemini API Logic =====
        async function generateReply({ text, moodScore, name, chatHistory }) {
            const GEMINI_API_KEY = "AIzaSyDgHqrrTXR8apwWUxJSomJgw-BODNFoC-E"; 
            const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
            
            if (!GEMINI_API_KEY) {
                return { text: "The chatbot is not configured. Please add a Gemini API key to the code.", crisis: false };
            }

            const moodDescription = MOODS.find(m => m.score === moodScore)?.label || "feeling neutral";
            const systemPrompt = `You are YouthMind, a playful and supportive pocket buddy for young adults in India. Your vibe is chatty, funny, and full of warmth — like a best friend who’s always ready to listen. You’re not a doctor, just a crazy-good listener who mixes empathy with jokes, hype, and desi vibes.

The user’s name is ${name || "Friend"}, and today they’re feeling ${moodDescription}.
Your replies should:
Be short and lively if the user shares something casual.
Expand into a descriptive but still engaging response (max 250–300 words) if the user’s input genuinely needs it.
Use emojis, humor, and curiosity to keep the convo flowing. Break long replies into short, readable chunks.
If the user hints at self-harm, depression, or overwhelming distress:
Pause the humor.
Switch to a mature, calm, and empathetic tone.
Offer comfort, remind them they’re not alone, and gently suggest reaching out to a trusted friend, family member, or professional.
Keep the language supportive and never judgmental. If user talk to you in hinglish then talk to user in hinglish.`;

            const payload = {
                contents: [ ...chatHistory, { role: 'user', parts: [{ text }] } ],
                systemInstruction: { parts: [{ text: systemPrompt }] },
            };
            
            try {
                const response = await fetch(GEMINI_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const errorBody = await response.json();
                    throw new Error(`API Error: ${errorBody.error.message}`);
                }
                const result = await response.json();
                const candidate = result.candidates?.[0];
                const botText = candidate?.content?.parts?.[0]?.text || "I'm not sure how to respond to that.";
                const crisisWords = ["suicide", "kill myself", "end it all", "self-harm", "cutting myself", "hopeless", "worthless", "no reason to live", "want to die", "better off dead", "end my life"];
                const isCrisis = crisisWords.some(w => text.toLowerCase().includes(w));
                
                return { 
                    text: isCrisis ? `Thank you for sharing that with me, ${name}. I'm hearing a lot of pain in your words, and I want you to know I'm here and listening. Your safety is the most important thing right now. If you're in immediate danger, please reach out to emergency services (like 112 in India) or a trusted adult. You're not alone in this. Sometimes just taking a moment to breathe can help. Can we try taking one slow, deep breath together? Inhale... and exhale.<b> check below you can talk to our counncellors, if feeling not good.` : botText,
                    crisis: isCrisis
                };
            } catch (error) {
                console.error("Error calling Gemini API:", error);
                return { text: "Sorry, I couldn't connect right now. Let's try again in a bit.", crisis: false };
            }
        }

        // ===== 4) Render Functions =====
        function renderLoadingScreen() {
            appRoot.innerHTML = `
                <div class="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-50 to-rose-50 dark:from-gray-900 dark:to-gray-950 p-4">
                    <div class="text-center space-y-3 scale-in">
                        <div class="flex justify-center items-center text-3xl font-bold text-gray-800 dark:text-gray-200 gap-3">
                           <svg class="w-10 h-10 text-indigo-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.5 16.5H14.5L12 13.25L9.5 16.5H7.5L11 12.25V7.5H13V12.25L16.5 16.5Z"/>
                            </svg>
                            <span class="text-4xl">YouthMind</span>
                        </div>
                        <div class="flex justify-center pt-2">
                            <div class="w-8 h-8 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>`;
        }
        
        function renderAuthCard(error = "", notice = "", loading = false) {
             appRoot.innerHTML = `<div class="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-50 via-white to-rose-50 dark:from-gray-900 dark:to-gray-950 p-4"><div id="auth-card" class="max-w-md w-full mx-auto bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg p-6 sm:p-8 space-y-6 fade-in dark:bg-gray-900/70"><div class="text-center"><div class="inline-flex items-center justify-center gap-3"><svg class="w-9 h-9 text-indigo-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.5 16.5H14.5L12 13.25L9.5 16.5H7.5L11 12.25V7.5H13V12.25L16.5 16.5Z"/></svg><h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100">YouthMind</h1></div><p class="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">Your friendly pocket counsellor 💬</p></div><div class="flex justify-center gap-2 text-sm"><button id="mode-signin" class="px-4 py-1.5 rounded-full font-semibold transition-all bg-indigo-600 text-white shadow-sm">Sign in</button><button id="mode-signup" class="px-4 py-1.5 rounded-full font-semibold transition-all bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">Sign up</button></div><form id="auth-form" class="space-y-4"><div id="name-field-container" class="hidden"><input class="w-full bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 transition-shadow focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 dark:text-white" placeholder="Your name" name="name" /></div><input class="w-full bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 transition-shadow focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 dark:text-white" type="email" placeholder="email@address.com" name="email" required /><input class="w-full bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 transition-shadow focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 dark:text-white" type="password" placeholder="password" name="password" required />${error ? `<div class="text-sm text-red-600 dark:text-red-400 text-center">${error}</div>` : ''}${notice ? `<div class="text-sm text-green-700 dark:text-green-400 text-center">${notice}</div>` : ''}<button type="submit" ${loading ? 'disabled' : ''} class="w-full bg-indigo-600 text-white font-semibold rounded-xl py-2.5 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2">${loading ? `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Please wait...` : 'Sign in'}</button></form><div class="text-[11px] text-gray-500 dark:text-gray-400 text-center">By continuing you agree this is supportive self-care and not a substitute for professional diagnosis or treatment.</div></div></div>`;
        }

        function renderAppShell() {
             appRoot.innerHTML = `<div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-rose-50 dark:from-gray-900 dark:via-gray-950 dark:to-black text-gray-800 dark:text-gray-200"><header class="sticky top-0 backdrop-blur-lg bg-white/70 dark:bg-gray-950/70 border-b border-gray-200/80 dark:border-gray-800/80 z-20"><div class="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between"><div class="flex items-center gap-3"><svg class="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.5 16.5H14.5L12 13.25L9.5 16.5H7.5L11 12.25V7.5H13V12.25L16.5 16.5Z"/></svg><h1 class="font-bold text-xl text-gray-800 dark:text-gray-100">YouthMind</h1></div><div class="flex items-center gap-2 sm:gap-4 text-sm"><span class="hidden sm:block text-gray-600 dark:text-gray-400">Hi, ${profile?.displayName || "Friend"} 👋</span><!--<button id="theme-toggle-btn" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"><svg id="theme-icon-sun" class="w-5 h-5 text-gray-700 ${isDarkMode ? 'hidden' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg><svg id="theme-icon-moon" class="w-5 h-5 text-gray-300 ${!isDarkMode ? 'hidden' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg></button>--><button id="sign-out-btn" class="px-3 py-1.5 rounded-xl bg-gray-800 text-white font-semibold hover:bg-gray-900 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white transition-colors text-xs sm:text-sm">Sign out</button></div></div></header><main id="main-content" class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 fade-in"></main>
                    <footer class="max-w-6xl mx-auto px-4 sm:px-6 pb-8 text-xs text-gray-500 dark:text-gray-400 text-center space-y-4">
                        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-left text-gray-600 dark:text-gray-400">
                            <div class="col-span-2 md:col-span-1">
                                <h4 class="font-bold text-sm text-gray-800 dark:text-gray-200">YouthMind</h4>
                                <p class="mt-1">Your daily companion for mental wellness.</p>
                            </div>
                            <div><h5 class="font-semibold">Benefits</h5><ul class="mt-1 space-y-1"><li>Your Personal Buddy</li><li>A Safe Space to Share</li><li>Track Your Journey</li><li>Mindful Activities</li><li>Avoid Self-Harm Convo</li></ul></div>
                            <div><h5 class="font-semibold">Support</h5><ul class="mt-1 space-y-1"><li>Not a medical device</li><li>For emergencies in India dial 112</li></ul></div>
                             <div class="col-span-2 md:col-span-2 text-right">
                                <p class="font-semibold">Created by MuditWebDev</p>
                                <p class="font-bold text-indigo-500">Made with love, for love.</p>
                            </div>
                        </div>
                        <div class="border-t border-gray-200 dark:border-gray-800 pt-4 text-center">
                            <p>&copy; ${new Date().getFullYear()} YouthMind. All Rights Reserved.</p>
                        </div>
                    </footer>
                </div>`;
        }
        
        function renderAppContent(loading = false) {
            const mainContent = document.getElementById('main-content');
            if (!mainContent) return;
            mainContent.innerHTML = `
                <div class="mb-8 p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-center text-indigo-800 dark:text-indigo-200 slide-up">
                    <p>${GREETINGS(profile?.displayName || "Friend")}</p>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
                    <div class="lg:col-span-3 space-y-6 sm:space-y-8">
                        ${loading ? renderMoodPickerSkeleton() : renderMoodPicker()}
                        ${loading ? renderCalendarSkeleton() : renderCalendar(calendarMap)}
                    </div>
                    <div class="lg:col-span-2 space-y-6 sm:space-y-8">
                        ${loading ? renderChatSkeleton() : renderChatBox()}
                        ${loading ? renderMusicPlayerSkeleton() : renderMusicPlayer()}
                        ${loading ? renderChartSkeleton() : renderMoodChart(chartData)}
                    </div>
                </div>
                ${renderCounselorSection()}
                `;
             if (!loading) {
                updateChatMessages(chatMessages, false, false);
                renderNotes();
             }
        }
        
        function renderMoodPicker() {
             return `
                <div id="mood-picker" class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-4 sm:p-5 slide-up dark:bg-gray-900/70 dark:border dark:border-gray-800">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold">How are you feeling today?</h3>
                        <span class="text-sm text-gray-500 dark:text-gray-400">${dateId()}</span>
                    </div>
                    <div class="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
                        ${MOODS.map(m => `
                            <button data-score="${m.score}" aria-label="Select mood: ${m.label}" class="mood-btn flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 py-3 sm:py-4 transition-all duration-200 transform hover:scale-105 hover:shadow-md dark:hover:bg-gray-800 ${todayMood?.score === m.score ? 'bg-indigo-600 text-white border-indigo-600 dark:border-indigo-500' : 'hover:bg-gray-50'}">
                                <div class="text-3xl sm:text-4xl">${m.emoji}</div>
                                <div class="text-xs mt-1.5 font-medium">${m.label}</div>
                            </button>`).join('')}
                    </div>
                    <div class="mt-4">
                        <div id="notes-list" class="space-y-2 mb-2"></div>
                        <div class="flex gap-2">
                           <input id="note-input" class="flex-1 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-xl p-3 text-sm transition-shadow focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 dark:text-white" placeholder="Add a note for today..."/>
                           <button id="add-note-btn" class="px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all">Add</button>
                        </div>
                    </div>
                </div>`;
        }
        
        function renderNotes() {
            const notesListEl = document.getElementById('notes-list');
            if (!notesListEl) return;
            const notes = todayMood?.notes || [];
            notesListEl.innerHTML = notes.map((note, index) => `
                <div class="note-item flex items-center gap-3 bg-gray-100 dark:bg-gray-800 p-2.5 rounded-lg fade-in">
                    <p class="text-sm flex-grow">${note}</p>
                     <button data-note-index="${index}" class="note-delete-btn flex-shrink-0 w-6 h-6 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/50 grid place-items-center transition-colors">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>
                    </button>
                </div>
            `).join('');
        }

        function renderCalendar(items) {
            const now = new Date();
            const year = now.getFullYear(), month = now.getMonth();
            const startDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const cells = Array(startDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
            const scoreToEmoji = (score) => MOODS.find(m => m.score === score)?.emoji || '·';

            return `
                <div class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-4 sm:p-5 slide-up dark:bg-gray-900/70 dark:border dark:border-gray-800" style="animation-delay: 100ms;">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-lg font-semibold">This Month</h3>
                        <span class="text-sm text-gray-500 dark:text-gray-400">${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 dark:text-gray-400 font-semibold mb-2">
                        ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div>${d}</div>`).join('')}
                    </div>
                    <div class="grid grid-cols-7 gap-1">
                        ${cells.map(d => {
                            const id = d ? dateId(new Date(year, month, d)) : null;
                            const score = id ? items[id] : undefined;
                            return `
                                <div class="h-12 rounded-lg flex items-center justify-center ${d ? 'border border-gray-100 dark:border-gray-800' : ''}">
                                    ${d ? `<div class="flex flex-col items-center leading-tight"><span class="text-xs text-gray-400 dark:text-gray-500">${d}</span><span class="text-xl mt-0.5">${scoreToEmoji(score)}</span></div>` : ''}
                                </div>`;
                        }).join('')}
                    </div>
                </div>`;
        }
        
        function renderChatBox() {
            return `
                 <div id="chat-box" class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg flex flex-col h-[28rem] sm:h-[26rem] slide-up dark:bg-gray-900/70 dark:border dark:border-gray-800" style="animation-delay: 150ms;">
                    <div id="chat-alert-box"></div>
                    <div id="chat-messages" class="flex-1 overflow-auto p-4 space-y-3"></div>
                    <div class="p-3 border-t border-gray-200 dark:border-gray-800 flex gap-2 items-center">
                        <input id="chat-input" class="flex-1 bg-gray-100 dark:bg-gray-800 border-transparent rounded-xl px-4 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" placeholder="Say anything..." />
                        <button id="chat-send-btn" aria-label="Send message" class="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                        </button>
                    </div>
                </div>`;
        }
        
        function renderMusicPlayer() {
            return `
                <div id="music-player" class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-4 slide-up dark:bg-gray-900/70 dark:border dark:border-gray-800" style="animation-delay: 200ms;">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3 overflow-hidden">
                            <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-12c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"></path></svg>
                            </div>
                            <div>
                                <h4 class="font-semibold text-sm">Keep Shining ✨</h4>
                                <p id="track-name" class="text-xs text-gray-500 dark:text-gray-400 music-player-track">Soothing Sounds</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 sm:gap-2">
                           <button id="shuffle-btn" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${isShuffled ? 'text-indigo-500' : 'text-gray-500'}">
                               <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 3zM3.055 6.333A.75.75 0 014 7.252v5.496l1.22-.813a.75.75 0 01.96 1.154l-2.25 1.5a.75.75 0 01-.96-.002l-2.25-1.5a.75.75 0 11.96-1.152l1.22.813V7.252a.75.75 0 01.945-.919zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zm-4.945-8.667a.75.75 0 01.945.919V12.75l-1.22.813a.75.75 0 11-.96-1.152l2.25-1.5a.75.75 0 01.96-.002l2.25 1.5a.75.75 0 11-.96 1.154l-1.22-.813v-5.496a.75.75 0 01-.75-.919zM16.945 6.333a.75.75 0 01.75.919v5.496l1.22-.813a.75.75 0 11.96 1.154l-2.25 1.5a.75.75 0 01-.96-.002l-2.25-1.5a.75.75 0 11.96-1.152l1.22.813V7.252a.75.75 0 01.75-.919z" clip-rule="evenodd"></path></svg>
                           </button>
                           <button id="play-pause-btn" class="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 active:scale-95 transition-all shadow-md">
                               <svg id="play-icon" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path></svg>
                               <svg id="pause-icon" class="w-5 h-5 hidden" fill="currentColor" viewBox="0 0 20 20"><path d="M5.75 4.5a.75.75 0 00-.75.75v10a.75.75 0 001.5 0V5.25A.75.75 0 005.75 4.5zm8.5 0a.75.75 0 00-.75.75v10a.75.75 0 001.5 0V5.25a.75.75 0 00-.75-.75z"></path></svg>
                           </button>
                           <button id="next-btn" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-500">
                               <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M15.95 10.354a.75.75 0 000-1.06l-4.5-4.5a.75.75 0 10-1.06 1.06L14.06 9.25H4.75a.75.75 0 100 1.5h9.31l-3.67 3.67a.75.75 0 101.06 1.06l4.5-4.5z" clip-rule="evenodd"></path></svg>
                           </button>
                        </div>
                    </div>
                </div>`;
        }
        
        function renderCounselorSection() {
            return `
                <div class="mt-8 text-center slide-up" style="animation-delay: 300ms;">
                     <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">Ready to talk to someone?</h2>
                     <p class="mt-4 max-w-2xl mx-auto text-lg leading-8 text-gray-600 dark:text-gray-400">
                        It's okay to not be okay. Talking about your mental health is a sign of strength, not weakness. Our professional counselors are here to provide a safe, confidential space for you to explore your feelings.
                     </p>
                </div>
                <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 slide-up" style="animation-delay: 400ms;">
                    ${COUNSELORS.map(c => `
                        <div class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-6 text-center dark:bg-gray-900/70 dark:border dark:border-gray-800">
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${c.name}</h3>
                            <p class="text-sm text-indigo-500 dark:text-indigo-400 mt-1">${c.degree}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">${c.experience} of experience</p>
                             <a href="https://wa.me/${c.whatsapp}?text=${encodeURIComponent("Hello, I'd like to connect from YouthMind.")}" target="_blank" class="mt-4 inline-block w-full bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors">
                                Connect on WhatsApp (Free)
                            </a>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function renderMoodChart(data) {
           return `<div class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-4 sm:p-5 h-72 slide-up dark:bg-gray-900/70 dark:border dark:border-gray-800" style="animation-delay: 250ms;"><h3 class="text-lg font-semibold mb-2">Last 30 Days</h3><div class="w-full h-56 relative" id="chart-container-wrapper"></div></div>`;
        }

        function drawInteractiveChart(data) {
            const wrapper = document.getElementById('chart-container-wrapper');
            if (!wrapper || !data) return;
            wrapper.innerHTML = '';
            
            const tooltip = document.createElement('div');
            tooltip.className = 'absolute z-10 p-3 text-xs rounded-lg shadow-lg bg-white dark:bg-gray-800 border dark:border-gray-700 transition-all duration-200 opacity-0 pointer-events-none';
            wrapper.appendChild(tooltip);

            const canvas = document.createElement('canvas');
            wrapper.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            
            const dpr = window.devicePixelRatio || 1;
            const rect = wrapper.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            const margin = { top: 10, right: 15, bottom: 25, left: 65 };
            const plotWidth = rect.width - margin.left - margin.right;
            const plotHeight = rect.height - margin.top - margin.bottom;

            const moodLabels = ["Very Sad", "Sad", "Neutral", "Happy", "Very Happy"];
            const scoreToY = (score) => plotHeight - ( (MOODS.findIndex(m=>m.score===score)) / (MOODS.length -1) * plotHeight );

            const validData = data.map((d,i) => d.score !== null ? { ...d, index: i } : null).filter(Boolean);
            const points = validData.map(d => ({
                x: (d.index / (data.length - 1 || 1)) * plotWidth + margin.left,
                y: scoreToY(d.score) + margin.top,
                data: d
            }));
            
            let animationFrameId;
            let currentHoverPoint = null;

            // Main draw function
            function draw(progress = 1) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw grid lines and labels
                moodLabels.forEach((label, index) => {
                    const y = plotHeight - (index / (moodLabels.length - 1)) * plotHeight + margin.top;
                    ctx.beginPath();
                    ctx.moveTo(margin.left, y);
                    ctx.lineTo(margin.left + plotWidth, y);
                    ctx.strokeStyle = isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.7)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.fillStyle = isDarkMode ? '#6b7280' : '#9ca3af';
                    ctx.font = '10px Inter';
                    ctx.textAlign = 'right';
                    ctx.fillText(label, margin.left - 8, y + 4);
                });

                // Draw path and gradient
                if(points.length > 1) {
                    ctx.save();
                    const endPoint = points[Math.floor((points.length - 1) * progress)];
                    ctx.beginPath();
                    ctx.rect(0, 0, endPoint.x + 5, rect.height);
                    ctx.clip();

                    ctx.beginPath();
                    ctx.moveTo(points[0].x, points[0].y);
                    for (let i = 0; i < points.length - 1; i++) {
                        const xc = (points[i].x + points[i+1].x) / 2;
                        const yc = (points[i].y + points[i+1].y) / 2;
                        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                    }
                    ctx.quadraticCurveTo(points[points.length-1].x, points[points.length-1].y, points[points.length-1].x, points[points.length-1].y);
                    
                    const lineStyle = isDarkMode ? "#a78bfa" : "#4f46e5";
                    ctx.strokeStyle = lineStyle;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = isDarkMode ? 'rgba(167, 139, 250, 0.5)' : 'rgba(79, 70, 229, 0.5)';
                    ctx.shadowBlur = 8;
                    ctx.shadowOffsetY = 2;
                    ctx.stroke();
                    
                    // Reset shadow for gradient fill
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;

                    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
                    gradient.addColorStop(0, isDarkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(79, 70, 229, 0.3)');
                    gradient.addColorStop(1, isDarkMode ? 'rgba(139, 92, 246, 0)' : 'rgba(79, 70, 229, 0)');

                    ctx.lineTo(points[points.length-1].x, rect.height - margin.bottom);
                    ctx.lineTo(points[0].x, rect.height - margin.bottom);
                    ctx.closePath();
                    ctx.fillStyle = gradient;
                    ctx.fill();
                    ctx.restore();
                }
                
                // Draw points
                points.forEach((p, i) => {
                    if (p.x > points[Math.floor((points.length - 1) * progress)].x) return;
                    
                    const isHovered = currentHoverPoint === p;
                    const radius = isHovered ? 6 : 4;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = isDarkMode ? '#111827' : 'white';
                    ctx.fill();
                    ctx.strokeStyle = MOODS.find(m => m.score === p.data.score)?.color || '#4f46e5';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                });
            }

            let startTime = null;
            function animate(timestamp) {
                if (!startTime) startTime = timestamp;
                const runtime = timestamp - startTime;
                const progress = Math.min(runtime / 800, 1);
                draw(progress);
                if (progress < 1) {
                    animationFrameId = requestAnimationFrame(animate);
                }
            }
            
            animationFrameId = requestAnimationFrame(animate);
            
            // Mouse move for tooltips
            canvas.addEventListener('mousemove', (e) => {
                const mouseX = e.offsetX;
                const mouseY = e.offsetY;
                let foundPoint = null;
                for(const p of points) {
                    const dist = Math.sqrt(Math.pow(p.x - mouseX, 2) + Math.pow(p.y - mouseY, 2));
                    if(dist < 10) {
                        foundPoint = p;
                        break;
                    }
                }
                
                if (foundPoint && currentHoverPoint !== foundPoint) {
                    currentHoverPoint = foundPoint;
                    draw(1); // Redraw to show hover effect
                    const mood = MOODS.find(m => m.score === foundPoint.data.score);
                    let notesHTML = foundPoint.data.notes?.length > 0
                        ? `<ul class="mt-1 space-y-1">${foundPoint.data.notes.map(n => `<li class="list-disc ml-3.5">${n}</li>`).join('')}</ul>`
                        : '<p class="opacity-70 mt-1">No notes for this day.</p>';

                    tooltip.innerHTML = `<div class="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5"><span style="color:${mood.color}">${mood.emoji}</span>${mood.label} (${foundPoint.data.date.slice(5)})</div>${notesHTML}`;
                    tooltip.style.opacity = '1';
                    
                    const tooltipRect = tooltip.getBoundingClientRect();
                    let left = foundPoint.x + 15;
                    let top = foundPoint.y - 15;
                    if (left + tooltipRect.width > rect.width) {
                        left = foundPoint.x - tooltipRect.width - 15;
                    }

                    tooltip.style.transform = `translate(${left}px, ${top}px)`;
                    canvas.style.cursor = 'pointer';
                } else if (!foundPoint && currentHoverPoint) {
                    currentHoverPoint = null;
                    draw(1); // Redraw to remove hover effect
                    tooltip.style.opacity = '0';
                    canvas.style.cursor = 'default';
                }
            });
            
             canvas.addEventListener('mouseleave', () => {
                if (currentHoverPoint) {
                    currentHoverPoint = null;
                    draw(1);
                    tooltip.style.opacity = '0';
                    canvas.style.cursor = 'default';
                }
            });
        }


        // ===== 4.1) Skeleton Renderers =====
        function renderMoodPickerSkeleton() { return `<div class="bg-white/80 dark:bg-gray-900/70 rounded-2xl shadow-lg p-5 space-y-4"><div class="skeleton h-6 w-3/4"></div><div class="grid grid-cols-5 gap-3">${Array(5).fill(0).map(() => `<div class="skeleton h-24"></div>`).join('')}</div><div class="skeleton h-16 w-full"></div></div>`; }
        function renderCalendarSkeleton() { return `<div class="bg-white/80 dark:bg-gray-900/70 rounded-2xl shadow-lg p-5 space-y-3"><div class="skeleton h-6 w-1/2"></div><div class="grid grid-cols-7 gap-1">${Array(35).fill(0).map(() => `<div class="skeleton h-12"></div>`).join('')}</div></div>`; }
        function renderChatSkeleton() { return `<div class="bg-white/80 dark:bg-gray-900/70 rounded-2xl shadow-lg h-[26rem] flex flex-col justify-between p-3"><div class="space-y-3"><div class="skeleton h-10 w-3/5"></div><div class="skeleton h-12 w-4/5 ml-auto"></div><div class="skeleton h-8 w-1/2"></div></div><div class="skeleton h-12 w-full"></div></div>`; }
        function renderMusicPlayerSkeleton() { return `<div class="bg-white/80 dark:bg-gray-900/70 rounded-2xl shadow-lg p-4 h-[72px]"><div class="skeleton h-full w-full"></div></div>`; }
        function renderChartSkeleton() { return `<div class="bg-white/80 dark:bg-gray-900/70 rounded-2xl shadow-lg p-5 h-72 space-y-3"><div class="skeleton h-6 w-1/3"></div><div class="skeleton h-full w-full"></div></div>`; }

        function updateChatMessages(messages, isTyping, showAlert) {
            const chatMessagesEl = document.getElementById('chat-messages');
            const chatAlertBoxEl = document.getElementById('chat-alert-box');
            if (!chatMessagesEl || !chatAlertBoxEl) return;

            chatAlertBoxEl.innerHTML = showAlert ? `<div class="bg-red-100 text-red-800 text-sm p-3 rounded-t-2xl font-medium fade-in dark:bg-red-900/30 dark:text-red-300">If you feel unsafe, call <b>112</b> (India). Consider speaking to a trusted person or a professional. You matter.</div>` : '';

            let messagesHtml = messages.map(m => `
                <div class="max-w-[85%] sm:max-w-[80%] w-fit text-sm slide-up ${m.sender==='user'?'ml-auto text-white bg-indigo-600 rounded-b-2xl rounded-tl-2xl shadow':'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-b-2xl rounded-tr-2xl'}">
                    <div class="px-3.5 py-2.5 whitespace-pre-wrap">${m.text}</div>
                </div>`).join('');
            
            if (isTyping) {
                messagesHtml += `<div class="max-w-[80%] w-fit text-sm bg-gray-100 dark:bg-gray-800 rounded-b-2xl rounded-tr-2xl px-3.5 py-2.5 slide-up"><div class="flex items-center gap-2 typing-indicator"><span class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></span><span class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></span><span class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></span></div></div>`;
            }

            chatMessagesEl.innerHTML = messagesHtml;
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }
        
        // ===== 5) Music Logic =====
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        function playNextSong() {
            currentTrackIndex++;
            const playlist = isShuffled ? shuffledPlaylist : musicPlaylist;
            if (currentTrackIndex >= playlist.length) {
                currentTrackIndex = 0; // Loop playlist
                if (isShuffled) { // Re-shuffle when the playlist completes
                    shuffledPlaylist = shuffleArray([...musicPlaylist]);
                }
            }
            loadAndPlaySong();
        }

        function loadAndPlaySong() {
            const playlist = isShuffled ? shuffledPlaylist : musicPlaylist;
            if (playlist.length === 0) return; // Don't play if playlist is empty
            const trackName = playlist[currentTrackIndex];
            audio.src = trackName;
            audio.play().catch(e => {
                // Autoplay can be blocked by browsers. This is a common issue.
                console.warn("Audio autoplay was blocked. User interaction is required to start playback.", e);
            });
            document.getElementById('play-icon').classList.add('hidden');
            document.getElementById('pause-icon').classList.remove('hidden');
        }

        // ===== 6) Data Logic =====
        async function refreshMoodData(uid) {
            if (!uid) return;
            const moodPath = `artifacts/${appId}/moods/${uid}/days`;
            
            const id = dateId();
            const tDoc = await getDoc(doc(db, moodPath, id));
            todayMood = tDoc.exists() ? tDoc.data() : { notes: [] };

            const now = new Date();
            const year = now.getFullYear(), month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthPromises = Array.from({length: daysInMonth}, (_, i) => getDoc(doc(db, moodPath, dateId(new Date(year, month, i + 1)))));
            
            const seriesPromises = Array.from({length: 30}, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (29-i));
                return getDoc(doc(db, moodPath, dateId(d)));
            });

            const [monthDocs, seriesDocs] = await Promise.all([Promise.all(monthPromises), Promise.all(seriesPromises)]);
            
            calendarMap = {};
            monthDocs.forEach(dd => { if (dd.exists()) calendarMap[dd.id] = dd.data().score; });

            chartData = seriesDocs.map((dd, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (29 - i));
                const data = dd.exists() ? dd.data() : {};
                return { date: dateId(d), score: data.score ?? null, notes: data.notes || [] };
            });
        }
        
        async function handleMoodPick(score) {
            const mood = MOODS.find(m => m.score === score);
            if (!user || !mood) return;

            const id = dateId();
            const moodPath = `artifacts/${appId}/moods/${user.uid}/days`;
            const userPath = `artifacts/${appId}/users/${user.uid}`;
            
            const moodData = { score: mood.score, label: mood.label, createdAt: serverTimestamp() };
            if (!todayMood) todayMood = { notes: [] };
            todayMood.score = mood.score;
            todayMood.label = mood.label;
            
            await setDoc(doc(db, moodPath, id), moodData, { merge: true });
            await setDoc(doc(db, userPath), { lastCheckIn: id }, { merge: true });
            
            await refreshMoodData(user.uid);
            renderAppContent(false);
            drawInteractiveChart(chartData);
        }

        async function handleAddNote() {
            const noteInput = document.getElementById('note-input');
            const noteText = noteInput.value.trim();
            if (!noteText || !user) return;
            
            noteInput.value = '';
            const id = dateId();
            const moodPath = `artifacts/${appId}/moods/${user.uid}/days`;
            const moodDocRef = doc(db, moodPath, id);
            
            await setDoc(moodDocRef, { notes: arrayUnion(noteText) }, { merge: true });
            if (!todayMood) todayMood = { notes: [] };
            if (!todayMood.notes) todayMood.notes = [];
            todayMood.notes.push(noteText);
            
            const todayInChart = chartData.find(d => d.date === id);
            if(todayInChart) todayInChart.notes.push(noteText);

            renderNotes();
        }

        async function handleDeleteNote(index) {
            const noteText = todayMood?.notes?.[index];
            if (!noteText || !user) return;
            
            const id = dateId();
            const moodPath = `artifacts/${appId}/moods/${user.uid}/days`;
            const moodDocRef = doc(db, moodPath, id);

            await updateDoc(moodDocRef, { notes: arrayRemove(noteText) });
            todayMood.notes.splice(index, 1);
            
            const todayInChart = chartData.find(d => d.date === id);
            if(todayInChart) todayInChart.notes = todayMood.notes;

            renderNotes();
        }

        async function handleChatSend() {
            const inputEl = document.getElementById('chat-input');
            const sendBtn = document.getElementById('chat-send-btn');
            const text = inputEl.value.trim();
            if (!text) return;

            inputEl.value = "";
            inputEl.disabled = true;
            sendBtn.disabled = true;

            const tempUserMessageId = `temp_${Date.now()}`;
            const userMessageData = { text, sender: "user", sentAt: new Date() }; // Use local date for immediate display
            chatMessages.push({ id: tempUserMessageId, ...userMessageData });
            updateChatMessages(chatMessages, true, document.getElementById('chat-alert-box').innerHTML !== '');
            
            try {
                const chatPath = `artifacts/${appId}/chats/${user.uid}/messages`;
                await addDoc(collection(db, chatPath), { text, sender: "user", sentAt: serverTimestamp() });
                
                const recentHistory = chatMessages.slice(-11, -1).map(m => ({
                    role: m.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: m.text }]
                }));

                const reply = await generateReply({ text, moodScore: todayMood?.score ?? 0, name: profile.displayName, chatHistory: recentHistory });
                await addDoc(collection(db, chatPath), { text: reply.text, sender: "bot", sentAt: serverTimestamp() });

            } catch (error) {
                console.error("Failed to send message:", error);
                chatMessages = chatMessages.filter(m => m.id !== tempUserMessageId);
                updateChatMessages(chatMessages, false, false);
            } finally {
                inputEl.disabled = false;
                sendBtn.disabled = false;
                inputEl.focus();
            }
        }
        
        // ===== 7) Event Listeners & Main App Flow =====
        function applyTheme() {
            document.documentElement.classList.toggle('dark', isDarkMode);
            localStorage.setItem('youthmind-theme', isDarkMode ? 'dark' : 'light');
            
            const sunIcon = document.getElementById('theme-icon-sun');
            const moonIcon = document.getElementById('theme-icon-moon');
            if(sunIcon && moonIcon){
                sunIcon.classList.toggle('hidden', isDarkMode);
                moonIcon.classList.toggle('hidden', !isDarkMode);
            }
            
            if (user) drawInteractiveChart(chartData);
        }

        function setupEventListeners() {
            appRoot.addEventListener('click', async (e) => {
                const target = e.target.closest('button');
                if (!target) return;

                if (target.id === 'mode-signin' || target.id === 'mode-signup') {
                    const isSignin = target.id === 'mode-signin';
                    document.getElementById('mode-signin').classList.toggle('bg-indigo-600', isSignin);
                    document.getElementById('mode-signin').classList.toggle('text-white', isSignin);
                    document.getElementById('mode-signin').classList.toggle('shadow-sm', isSignin);
                    document.getElementById('mode-signin').classList.toggle('bg-gray-100', !isSignin);
                    document.getElementById('mode-signin').classList.toggle('text-gray-700', !isSignin);
                    document.getElementById('mode-signin').classList.toggle('dark:bg-gray-800', !isSignin);
                    document.getElementById('mode-signin').classList.toggle('dark:text-gray-300', !isSignin);
                    
                    document.getElementById('mode-signup').classList.toggle('bg-indigo-600', !isSignin);
                    document.getElementById('mode-signup').classList.toggle('text-white', !isSignin);
                    document.getElementById('mode-signup').classList.toggle('shadow-sm', !isSignin);
                    document.getElementById('mode-signup').classList.toggle('bg-gray-100', isSignin);
                    document.getElementById('mode-signup').classList.toggle('text-gray-700', isSignin);
                    document.getElementById('mode-signup').classList.toggle('dark:bg-gray-800', isSignin);
                    document.getElementById('mode-signup').classList.toggle('dark:text-gray-300', isSignin);

                    document.getElementById('name-field-container').classList.toggle('hidden', isSignin);
                    document.querySelector('#auth-form button').innerHTML = isSignin ? 'Sign in' : 'Create account';
                }
                if (target.id === 'sign-out-btn') await signOut(auth);
                const moodBtn = target.closest('.mood-btn');
                if (moodBtn) handleMoodPick(parseInt(moodBtn.dataset.score, 10));
                if (target.id === 'chat-send-btn') handleChatSend();
                if (target.id === 'theme-toggle-btn') {
                    isDarkMode = !isDarkMode;
                    applyTheme();
                }
                if (target.id === 'add-note-btn') {
                    e.preventDefault();
                    handleAddNote();
                }
                const deleteBtn = target.closest('.note-delete-btn');
                if (deleteBtn) {
                    const index = parseInt(deleteBtn.dataset.noteIndex, 10);
                    const noteItem = deleteBtn.parentElement;
                    noteItem.classList.add('deleting');
                    setTimeout(() => handleDeleteNote(index), 300);
                }
                
                // Music Player controls
                if (target.id === 'play-pause-btn') {
                    if (audio.paused) {
                        if (audio.src) { audio.play().catch(e=>console.error(e)); } else { loadAndPlaySong(); }
                    } else { audio.pause(); }
                }
                if (target.id === 'next-btn') playNextSong();
                if (target.id === 'shuffle-btn') {
                    isShuffled = !isShuffled;
                    target.classList.toggle('text-indigo-500', isShuffled);
                    target.classList.toggle('text-gray-500', !isShuffled);
                    if (isShuffled) {
                        shuffledPlaylist = shuffleArray([...musicPlaylist]);
                        currentTrackIndex = 0;
                    }
                }
            });

             appRoot.addEventListener('submit', async (e) => {
                if (e.target.id === 'auth-form') {
                    e.preventDefault();
                     const formData = new FormData(e.target);
                    const { email, password, name } = Object.fromEntries(formData.entries());
                    const isSignup = !document.getElementById('name-field-container').classList.contains('hidden');
                    renderAuthCard("", "", true);
                    try {
                        if (isSignup) {
                            const cred = await createUserWithEmailAndPassword(auth, email, password);
                            const displayName = titleCase(name || email.split("@")[0]);
                            await updateProfile(cred.user, { displayName });
                            await setDoc(doc(db, `artifacts/${appId}/users/${cred.user.uid}`), { displayName, joinedAt: serverTimestamp() });
                        } else {
                            await signInWithEmailAndPassword(auth, email, password);
                        }
                    } catch (err) {
                        const message = err.code ? err.code.replace('auth/', '').replace(/-/g, ' ') : err.message;
                        renderAuthCard(titleCase(message), "", false);
                    }
                }
            });
            
            appRoot.addEventListener('keydown', (e) => {
                if(e.target.id === 'chat-input' && e.key === 'Enter') {
                    e.preventDefault();
                    handleChatSend();
                }
                 if(e.target.id === 'note-input' && e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNote();
                }
            });

            audio.addEventListener('play', () => {
                document.getElementById('play-icon')?.classList.add('hidden');
                document.getElementById('pause-icon')?.classList.remove('hidden');
            });
            audio.addEventListener('pause', () => {
                document.getElementById('play-icon')?.classList.remove('hidden');
                document.getElementById('pause-icon')?.classList.add('hidden');
            });
            audio.addEventListener('ended', playNextSong);
        }
        
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if(user) drawInteractiveChart(chartData);
            }, 150);
        });

        function main() {
            const savedTheme = localStorage.getItem('youthmind-theme');
            isDarkMode = savedTheme === 'dark';
            document.documentElement.classList.toggle('dark', isDarkMode);


            renderLoadingScreen();
            try {
                app = initializeApp(firebaseConfig);
                db = getFirestore(app);
                auth = getAuth(app);
                setPersistence(auth, browserLocalPersistence);
            } catch (e) {
                appRoot.innerHTML = `<div class="p-4 text-red-600">Firebase initialization failed. Check console for details.</div>`;
                console.error(e);
                return;
            }

            setupEventListeners();

            onAuthStateChanged(auth, async (u) => {
                if (chatUnsubscribe) chatUnsubscribe();
                if (u) {
                    user = u;
                    renderAppShell();
                    applyTheme(); // Re-apply theme to new DOM
                    renderAppContent(true);
                    
                    const userDoc = await getDoc(doc(db, `artifacts/${appId}/users/${u.uid}`));
                    profile = userDoc.exists() ? { uid: u.uid, ...userDoc.data() } : { uid: u.uid, displayName: u.displayName || u.email?.split('@')[0] || "Friend" };

                    const chatPath = `artifacts/${appId}/chats/${u.uid}/messages`;
                    const q = query(collection(db, chatPath), orderBy("sentAt", "asc"));
                    chatUnsubscribe = onSnapshot(q, (snap) => {
                        chatMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                        const chatInput = document.getElementById('chat-input');
                        const isTyping = chatInput ? chatInput.disabled : false;
                        updateChatMessages(chatMessages, isTyping, false);
                    });

                    await refreshMoodData(u.uid);
                    renderAppContent(false);
                    drawInteractiveChart(chartData);
                    
                    // Shuffle playlist on login to prepare for playback
                    shuffledPlaylist = shuffleArray([...musicPlaylist]);
                    currentTrackIndex = 0;
                    // loadAndPlaySong(); // REMOVED to prevent autoplay on load

                } else {
                    user = null;
                    profile = null;
                    renderAuthCard();
                }
            });
        }
         // In your final app, you'll remove this and use your existing `isDarkMode` variable.
      

        const GEMINI_API_KEY = "AIzaSyDgHqrrTXR8apwWUxJSomJgw-BODNFoC-E"; // Your API Key
        const featureContainer = document.getElementById('feature-container');
        
       
        
        let quizPopupTimeout;
        let quizResultTimeout;

        // ===== 1. POPUP BANNER LOGIC =====
        function showQuizPopup() {
            const popupHTML = `
                <div id="quiz-popup-banner" class="quiz-popup fixed bottom-0 left-0 right-0 sm:bottom-5 sm:left-5 sm:right-auto sm:w-auto sm:max-w-md p-4 sm:rounded-lg shadow-2xl bg-white dark:bg-gray-800 border-t sm:border dark:border-gray-700 flex items-center justify-between pointer-events-auto">
                    <div>
                        <h4 class="font-semibold text-gray-800 dark:text-white">Quick Check-in?</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Take a moment to see how you're feeling.</p>
                    </div>
                    <button id="start-quiz-btn" class="ml-4 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0">Start Quiz</button>
                </div>
            `;
            featureContainer.innerHTML = popupHTML;

            document.getElementById('start-quiz-btn').addEventListener('click', openQuizModal);
            
            quizPopupTimeout = setTimeout(() => {
                const banner = document.getElementById('quiz-popup-banner');
                if (banner) banner.remove();
            },23456);
        }

        // ===== 2. QUIZ MODAL LOGIC =====
        async function openQuizModal() {
            clearTimeout(quizPopupTimeout);
            const banner = document.getElementById('quiz-popup-banner');
            if (banner) banner.remove();

            featureContainer.innerHTML = `
                <div id="quiz-modal" class="modal-overlay fixed inset-0 flex items-center justify-center p-4 pointer-events-auto">
                    <div class="modal-content w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
                        <div class="p-6 text-center">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Generating your check-in...</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Just a moment!</p>
                            <div class="flex justify-center mt-4">
                                <div class="w-8 h-8 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            try {
                const questions = await generateQuizQuestions();
                renderQuiz(questions);
            } catch (error) {
                console.error("Failed to generate quiz:", error);
                const modalContent = document.querySelector('.modal-content');
                if(modalContent) {
                    modalContent.innerHTML = `<div class="p-6 text-center"><h2 class="text-xl font-bold text-red-600">Oops!</h2><p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Could not generate the quiz. Please try again later.</p><button id="close-modal-btn" class="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">Close</button></div>`;
                    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
                }
            }
        }

        async function generateQuizQuestions() {
            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
            const prompt = "Generate 5 creative, funny, but insightful multiple-choice questions for a student's mental health check-in quiz. For each question, provide three options with corresponding scores: 2 for the most positive/healthy answer, 1 for a neutral answer, and 0 for a negative/unhealthy answer. Ensure questions are unique each time.";
            
            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            "quiz": {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        "question": { "type": "STRING" },
                                        "options": {
                                            type: "ARRAY",
                                            items: { type: "STRING" }
                                        },
                                        "scores": {
                                            type: "ARRAY",
                                            items: { type: "NUMBER" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("API request failed");
            const result = await response.json();
            const jsonText = result.candidates[0].content.parts[0].text;
            return JSON.parse(jsonText).quiz;
        }

        function renderQuiz(questions) {
            const modalContent = document.querySelector('.modal-content');
            if (!modalContent) return;

            const questionsHTML = questions.map((q, index) => `
                <div class="mb-6">
                    <p class="font-semibold text-gray-800 dark:text-gray-100">${index + 1}. ${q.question}</p>
                    <div class="mt-3 space-y-2 custom-radio">
                        ${q.options.map((opt, i) => `
                            <div>
                                <input type="radio" id="q${index}_opt${i}" name="question_${index}" value="${q.scores[i]}" required>
                                <label for="q${index}_opt${i}" class="block w-full p-3 text-sm rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer text-gray-700 dark:text-gray-300">
                                    ${opt}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

            modalContent.innerHTML = `
                <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div class="flex justify-between items-center">
                        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Mental State Check-in</h2>
                        <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
                    </div>
                </div>
                <form id="quiz-form" class="p-6 overflow-y-auto">
                    ${questionsHTML}
                    <button type="submit" class="w-full mt-4 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">Submit Answers</button>
                </form>
            `;

            document.getElementById('close-modal-btn').addEventListener('click', closeModal);
            document.getElementById('quiz-form').addEventListener('submit', handleQuizSubmit);
        }

        function handleQuizSubmit(event) {
            event.preventDefault();
            const form = event.target;
            const formData = new FormData(form);
            let totalScore = 0;
            for (const value of formData.values()) {
                totalScore += parseInt(value, 10);
            }
            showQuizResults(totalScore);
        }

        function showQuizResults(score) {
            let title, message, recommendation;

            if (score <= 5) {
                title = "It's Okay to Need Support";
                message = "It seems like things might be a bit heavy right now, and that's completely okay. Reaching out is a sign of strength.";
                recommendation = renderCounselorSection(true); // true for modal version
            } else if (score >= 6 && score <= 8) {
                title = "You're Doing Great!";
                message = "You're navigating things well. Remember to keep taking time for yourself. A little self-care goes a long way!";
                recommendation = `<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">Keep up the great work, champ!</p>`;
            } else {
                title = "You're Shining Bright! ✨";
                message = "Amazing! You're rocking it. Keep embracing that positive energy and spreading the good vibes.";
                recommendation = `<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">You're a true champion!</p>`;
            }

            const modalContent = document.querySelector('.modal-content');
            if (!modalContent) return;

               modalContent.innerHTML = `
                <div class="p-6 text-center flex flex-col max-h-[80vh]">
                    <div class="flex-shrink-0">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">${title}</h2>
                        <p class="mt-2 text-gray-700 dark:text-gray-300">Your Score: <span class="font-bold text-indigo-500">${score}/10</span></p>
                        <p class="mt-4 text-gray-600 dark:text-gray-400">${message}</p>
                    </div>
                    
                    <!-- This is the new scrollable container -->
                    <div class="mt-6 flex-grow overflow-y-auto p-1">
                        ${recommendation}
                    </div>

                     <button id="close-modal-btn" class="mt-6 px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm font-semibold flex-shrink-0">Close</button>
                </div>
            `;
            document.getElementById('close-modal-btn').addEventListener('click', closeModal);
            quizResultTimeout = setTimeout(closeModal, 60000); // Auto-close after 1 minute
        }
        function closeModal() {
            clearTimeout(quizResultTimeout);
            const modal = document.getElementById('quiz-modal');
            if(modal) modal.remove();
        }
        // ===== INITIALIZATION =====
        // Show the popup 1 second after the page loads
        setTimeout(showQuizPopup, 1000);
        main();
        





