import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// --- Utility helpers ---
const decodeHTMLEntities = (str = "") => {
  const txt = typeof document !== "undefined" ? document.createElement("textarea") : null;
  if (!txt) return str;
  txt.innerHTML = str;
  return txt.value;
};
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Fallback local questions
const LOCAL_QUESTIONS = [
  { question: "Which HTML tag is used to define an unordered list?", correct_answer: "<ul>", incorrect_answers: ["<ol>", "<li>", "<list>"], category: "Web", difficulty: "easy" },
  { question: "What is the output of: console.log(typeof NaN)?", correct_answer: "number", incorrect_answers: ["NaN", "undefined", "object"], category: "JavaScript", difficulty: "easy" },
  { question: "Which data structure uses FIFO order?", correct_answer: "Queue", incorrect_answers: ["Stack", "Tree", "Graph"], category: "CS", difficulty: "easy" },
  { question: "React hooks must be called…", correct_answer: "at the top level of a functional component", incorrect_answers: ["inside loops and conditions", "from class methods", "from any nested function"], category: "React", difficulty: "medium" },
  { question: "Which of these is NOT a valid HTTP method?", correct_answer: "FETCH", incorrect_answers: ["PUT", "PATCH", "DELETE"], category: "Web", difficulty: "medium" },
  { question: "In CSS, what does the 'rem' unit scale with?", correct_answer: "The root element's font-size", incorrect_answers: ["The parent element's font-size", "Viewport width", "Device pixel ratio"], category: "CSS", difficulty: "medium" },
  { question: "Which algorithm has average time complexity O(n log n)?", correct_answer: "Merge Sort", incorrect_answers: ["Bubble Sort", "Insertion Sort", "Counting Sort"], category: "Algorithms", difficulty: "medium" },
  { question: "What does SQL stand for?", correct_answer: "Structured Query Language", incorrect_answers: ["Simple Query Language", "Sequential Query Language", "Structured Question Language"], category: "Databases", difficulty: "easy" },
  { question: "Which Android component is responsible for background tasks that must finish even if the app closes?", correct_answer: "WorkManager", incorrect_answers: ["Service", "BroadcastReceiver", "ContentProvider"], category: "Android", difficulty: "hard" },
  { question: "The GCD of two numbers can be efficiently computed using…", correct_answer: "Euclid's algorithm", incorrect_answers: ["Sieve of Eratosthenes", "Fast Fourier Transform", "Karatsuba algorithm"], category: "Math", difficulty: "easy" },
];

// Helpers
const STORAGE_KEY_SETTINGS = "quiz_settings_v1";
const STORAGE_KEY_HISCORES = "quiz_highscores_v1";

function usePersistedSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return raw ? JSON.parse(raw) : { source: "api", amount: 10, difficulty: "any", timerSec: 30 };
    } catch {
      return { source: "api", amount: 10, difficulty: "any", timerSec: 30 };
    }
  });
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);
  return [settings, setSettings];
}

async function fetchTrivia({ amount = 10, difficulty = "any" }) {
  const diffParam = difficulty !== "any" ? `&difficulty=${difficulty}` : "";
  const url = `https://opentdb.com/api.php?amount=${amount}&type=multiple${diffParam}`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`Network error ${resp.status}`);
  const data = await resp.json();
  if (!data || !Array.isArray(data.results)) throw new Error("Bad API format");
  return data.results.map((q) => {
    const decodedQ = decodeHTMLEntities(q.question);
    const decodedCorrect = decodeHTMLEntities(q.correct_answer);
    const decodedIncorrect = q.incorrect_answers.map(decodeHTMLEntities);
    const options = shuffle([decodedCorrect, ...decodedIncorrect]);
    const correctIndex = options.indexOf(decodedCorrect);
    return { question: decodedQ, options, correctIndex, category: q.category, difficulty: q.difficulty };
  });
}

function getLocalQuestions(amount = 10, difficulty = "any") {
  const pool = difficulty === "any" ? LOCAL_QUESTIONS : LOCAL_QUESTIONS.filter(q => q.difficulty === difficulty);
  const chosen = shuffle(pool).slice(0, Math.min(amount, pool.length));
  return chosen.map((q) => {
    const options = shuffle([q.correct_answer, ...q.incorrect_answers]);
    const correctIndex = options.indexOf(q.correct_answer);
    return { question: q.question, options, correctIndex, category: q.category, difficulty: q.difficulty };
  });
}

function loadHighScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISCORES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveHighScore(entry) {
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => b.percent - a.percent || a.date.localeCompare(b.date));
  const top = list.slice(0, 20);
  localStorage.setItem(STORAGE_KEY_HISCORES, JSON.stringify(top));
  return top;
}

// UI
const PageShell = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900" style={{fontFamily: "Inter, Roboto, system-ui, -apple-system, 'Segoe UI', Roboto"}}>
    <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">⚡ Quiz App</h1>
        <nav className="text-sm text-slate-600">Built with React Hooks</nav>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    <footer className="max-w-3xl mx-auto px-4 pb-10 text-xs text-slate-500">© {new Date().getFullYear()} Quiz App</footer>
  </div>
);

function Home() {
  const navigate = useNavigate();
  const [settings, setSettings] = usePersistedSettings();

  const startQuiz = () => {
    navigate("/quiz", { state: { settings } });
  };

  return (
    <PageShell>
      <div className="grid gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-lg font-semibold mb-4">Get started</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-slate-600">Question Source</span>
              <select className="mt-1 w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-slate-400" value={settings.source} onChange={(e) => setSettings((s) => ({ ...s, source: e.target.value }))}>
                <option value="api">Open Trivia DB (API)</option>
                <option value="local">Local questions</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-slate-600">Number of Questions</span>
              <input type="number" min={5} max={10} className="mt-1 w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-slate-400" value={settings.amount} onChange={(e) => setSettings((s) => ({ ...s, amount: Math.max(5, Math.min(10, Number(e.target.value)||5)) }))} />
            </label>
            <label className="block">
              <span className="text-sm text-slate-600">Difficulty</span>
              <select className="mt-1 w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-slate-400" value={settings.difficulty} onChange={(e) => setSettings((s) => ({ ...s, difficulty: e.target.value }))}>
                <option value="any">Any</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-slate-600">Timer per Question (sec)</span>
              <input type="number" min={10} max={120} className="mt-1 w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-slate-400" value={settings.timerSec} onChange={(e) => setSettings((s) => ({ ...s, timerSec: Math.max(10, Math.min(120, Number(e.target.value)||30)) }))} />
            </label>
          </div>
          <button onClick={startQuiz} className="mt-5 px-5 py-3 rounded-2xl bg-slate-900 text-white font-medium hover:opacity-90 active:scale-95 transition">Start Quiz</button>
        </div>

        <HighScoresPanel />
      </div>
    </PageShell>
  );
}

function HighScoresPanel() {
  const scores = loadHighScores();
  if (!scores.length) return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <h3 className="font-semibold mb-2">High Scores</h3>
      <p className="text-sm text-slate-600">Play a quiz to record your best scores here.</p>
    </div>
  );
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <h3 className="font-semibold mb-3">High Scores</h3>
      <ul className="space-y-2 text-sm">
        {scores.map((s, idx) => (
          <li key={idx} className="flex items-center justify-between">
            <span className="truncate">{s.mode} • {s.amount}Q • {s.difficulty} • {new Date(s.date).toLocaleString()}</span>
            <span className="font-semibold">{Math.round(s.percent)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useQuestions(settings) {
  const [status, setStatus] = useState("idle");
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      setStatus("loading");
      setError("");
      try {
        const qs = settings.source === "api"
          ? await fetchTrivia({ amount: settings.amount, difficulty: settings.difficulty })
          : getLocalQuestions(settings.amount, settings.difficulty);
        if (!ignore) {
          if (!qs.length) throw new Error("No questions available");
          setQuestions(qs);
          setStatus("ready");
        }
      } catch (e) {
        console.error(e);
        if (!ignore) {
          if (settings.source === "api") {
            const qs = getLocalQuestions(settings.amount, settings.difficulty);
            if (qs.length) {
              setQuestions(qs);
              setStatus("ready");
            } else {
              setError("Failed to load questions. Please try again.");
              setStatus("error");
            }
          } else {
            setError("Failed to load local questions.");
            setStatus("error");
          }
        }
      }
    })();
    return () => { ignore = true; };
  }, [settings.source, settings.amount, settings.difficulty]);

  return { status, questions, error };
}

function ProgressBar({ value, max }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden" aria-label="Progress" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} role="progressbar">
      <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
    </div>
  );
}

function QuizPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const settings = state?.settings;
  const { status, questions, error } = useQuestions(settings || { source: "local", amount: 5, difficulty: "any" });

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings?.timerSec ?? 30);
  const isTransitioning = useRef(false);

  useEffect(() => {
    setTimeLeft(settings?.timerSec ?? 30);
    setSelected(null);
    setLocked(false);
  }, [index]);

  useEffect(() => {
    if (status !== "ready") return;
    if (locked) return;
    if (timeLeft <= 0) {
      handleLockAndNext(null, true);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, locked, status]);

  const q = questions[index];
  const total = questions.length;

  const handleSelect = (i) => setSelected(i);
  const handleLock = () => handleLockAndNext(selected, false);

  function handleLockAndNext(selIndex, auto = false) {
    if (isTransitioning.current) return;
    if (locked) return;
    if (selIndex === null && !auto) return;

    const isCorrect = selIndex !== null ? selIndex === q.correctIndex : false;
    const entry = { question: q.question, options: q.options, correctIndex: q.correctIndex, selectedIndex: selIndex, isCorrect, category: q.category, difficulty: q.difficulty };

    setAnswers((a) => {
      const updated = [...a];
      updated[index] = entry;
      return updated;
    });

    setLocked(true);
    isTransitioning.current = true;
    setTimeout(() => {
      if (index + 1 < total) {
        setIndex((i) => i + 1);
      } else {
        const correct = [...answers, entry].filter((x) => x?.isCorrect).length;
        const percent = (correct / total) * 100;
        const mode = settings?.source === 'api' ? 'API' : 'Local';
        saveHighScore({ percent, amount: total, difficulty: settings?.difficulty || 'any', mode, date: new Date().toISOString() });
        navigate("/results", { state: { answers: [...answers, entry], total } });
      }
      isTransitioning.current = false;
    }, 350);
  }

  const handleSkip = () => handleLockAndNext(null, true);

  const handlePrev = () => {
    if (index === 0) return;
    setIndex((i) => i - 1);
    const prev = answers[index - 1];
    setSelected(prev?.selectedIndex ?? null);
    setLocked(false);
  };

  if (status === "loading") {
    return (
      <PageShell>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-pulse">
          <div className="h-6 w-1/3 bg-slate-200 rounded mb-4" />
          <div className="h-4 w-full bg-slate-200 rounded mb-2" />
          <div className="h-4 w-11/12 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-10/12 bg-slate-200 rounded" />
        </div>
      </PageShell>
    );
  }
  if (status === "error") {
    return (
      <PageShell>
        <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
          <h2 className="text-lg font-semibold text-red-700">Unable to load questions</h2>
          <p className="text-sm text-slate-700 mt-2">{error || "An unexpected error occurred."}</p>
          <div className="mt-4 flex gap-3">
            <button className="px-4 py-2 rounded-xl bg-slate-900 text-white" onClick={() => window.location.reload()}>Retry</button>
            <button className="px-4 py-2 rounded-xl border" onClick={() => navigate("/")}>Back</button>
          </div>
        </div>
      </PageShell>
    );
  }
  if (status !== "ready") return null;
  const progressLabel = `Question ${index + 1} of ${total}`;

  return (
    <PageShell>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="text-sm text-slate-600">{progressLabel}</div>
          <div className="text-sm font-semibold" aria-live="polite">⏳ {timeLeft}s</div>
        </div>
        <ProgressBar value={index} max={total} />

        <AnimatePresence mode="wait">
          <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-4">
            <h2 className="text-lg font-semibold mb-4" aria-live="polite">{q.question}</h2>

            <div role="radiogroup" aria-label="Answer options" className="grid gap-3">
              {q.options.map((opt, i) => {
                const isSelected = selected === i;
                const showCorrect = locked && i === q.correctIndex;
                const showWrong = locked && isSelected && i !== q.correctIndex;
                return (
                  <button key={i} role="radio" aria-checked={isSelected} onClick={() => !locked && handleSelect(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !locked && handleSelect(i); } }} className={[
                    "text-left w-full px-4 py-3 rounded-xl border transition select-none",
                    isSelected && !locked ? "border-slate-900 ring-2 ring-slate-300" : "border-slate-200",
                    locked && showCorrect ? "bg-green-50 border-green-300" : "",
                    locked && showWrong ? "bg-red-50 border-red-300" : "",
                    !locked && "hover:bg-slate-50 active:scale-[.99]",
                  ].join(" ")}>
                    <span className="block">{opt}</span>
                    {locked && showCorrect && <span className="text-xs text-green-700">Correct</span>}
                    {locked && showWrong && <span className="text-xs text-red-700">Your choice</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="px-4 py-2 rounded-xl border" onClick={handlePrev} disabled={index === 0}>Previous</button>
              <div className="ml-auto flex gap-3">
                <button className="px-4 py-2 rounded-xl border" onClick={handleSkip} disabled={locked}>Skip</button>
                <button className="px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-50" onClick={handleLock} disabled={locked || selected === null}>
                  {index + 1 === total ? "Submit" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </PageShell>
  );
}

function ResultsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const answers = state?.answers || [];
  const total = state?.total || answers.length || 0;
  const correct = answers.filter((a) => a?.isCorrect).length;

  const restart = () => navigate("/");
  return (
    <PageShell>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-xl font-bold">You scored {correct}/{total}</h2>
        <p className="text-slate-600 text-sm mt-1">Review your answers below.</p>
        <div className="mt-4 grid gap-3">
          {answers.map((a, idx) => (
            <div key={idx} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">Q{idx + 1}. {a.question}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${a.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{a.isCorrect ? 'Correct' : 'Incorrect'}</span>
              </div>
              <ul className="mt-2 text-sm space-y-1">
                {a.options.map((opt, i) => (
                  <li key={i} className={[ i === a.correctIndex ? 'font-semibold' : '', i === a.selectedIndex && i !== a.correctIndex ? 'line-through' : '', ].join(' ')}>
                    {i === a.correctIndex ? '✅' : i === a.selectedIndex ? '✖️' : '•'} {opt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button className="px-4 py-2 rounded-xl border" onClick={() => navigate('/quiz', { replace: true })}>Retake (same settings)</button>
          <button className="px-4 py-2 rounded-xl bg-slate-900 text-white" onClick={restart}>Home</button>
        </div>
      </div>
    </PageShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
