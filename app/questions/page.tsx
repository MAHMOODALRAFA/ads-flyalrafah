"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPhone, hasStarted, hasAnsweredQuestions, markQuestionsAnswered } from "../lib/referral";

type Choice = { value: string; label: string };
type Question =
  | {
      id: "q1";
      title: string;
      subtitle?: string;
      type: "single";
      choices: Choice[];
    }
  | {
      id: "q2";
      title: string;
      subtitle?: string;
      type: "single";
      choices: Choice[];
    }
  | {
      id: "q3";
      title: string;
      subtitle?: string;
      type: "single";
      choices: Choice[];
    };

const ANSWERS_KEY_PREFIX = "flyalrafah_questions_answers__";

function answersKey(phone: string) {
  return `${ANSWERS_KEY_PREFIX}${phone || "unknown"}`;
}

export default function QuestionsPage() {
  const router = useRouter();

  // ✅ Guard
  useEffect(() => {
    if (!hasStarted()) {
      router.replace("/start");
      return;
    }
    if (hasAnsweredQuestions()) {
      router.replace("/share");
      return;
    }
  }, [router]);

  const phone = useMemo(() => getPhone(), []);

  const questions: Question[] = useMemo(
    () => [
      {
        id: "q1",
        title: "هل زرت شيراز من قبل؟ 🇮🇷🌸",
        subtitle: "نريد نعرف اهتمامك بالسفر داخل إيران",
        type: "single",
        choices: [
          { value: "yes", label: "نعم، زرتها" },
          { value: "no", label: "لا، ما زرتها" },
          { value: "planning", label: "أخطط لزيارتها قريباً" },
        ],
      },
      {
        id: "q2",
        title: "أي نوع سياحة تحبه أكثر في عمان؟ 🇴🇲✨",
        subtitle: "اختيار واحد يساعدنا نجهز عروض مناسبة",
        type: "single",
        choices: [
          { value: "nature", label: "طبيعة وجبال (جبل الأخضر / وادي شاب)" },
          { value: "beach", label: "بحر وشواطئ (قنتب / صور)" },
          { value: "desert", label: "صحراء وكشتات (وهيبة)" },
          { value: "city", label: "مدينة وأسواق (مطرح / نزوى)" },
        ],
      },
      {
        id: "q3",
        title: "متى غالباً تحب تسافر؟ 🗓️✈️",
        subtitle: "حتى نرسل لك العروض بالوقت المناسب",
        type: "single",
        choices: [
          { value: "weekend", label: "نهاية الأسبوع" },
          { value: "holiday", label: "الإجازات الرسمية" },
          { value: "anytime", label: "أي وقت" },
        ],
      },
    ],
    []
  );

  const [step, setStep] = useState(0); // 0..2
  const [saving, setSaving] = useState(false);

  const current = questions[step];

  function readSavedAnswers(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(answersKey(phone));
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  function writeSavedAnswers(next: Record<string, string>) {
    if (typeof window === "undefined") return;
    localStorage.setItem(answersKey(phone), JSON.stringify(next));
  }

  const [answers, setAnswers] = useState<Record<string, string>>(() => readSavedAnswers());

  async function onPick(choiceValue: string) {
    if (!current) return;
    if (saving) return;

    // ✅ Save locally
    const next = { ...answers, [current.id]: choiceValue };
    setAnswers(next);
    writeSavedAnswers(next);

    // ✅ Smooth step forward
    if (step < questions.length - 1) {
      // tiny delay for UX
      setSaving(true);
      setTimeout(() => {
        setStep((s) => s + 1);
        setSaving(false);
      }, 250);
      return;
    }

    // ✅ Finalize: mark once per phone + go share
    try {
      setSaving(true);

      // mark "answered" (signed localStorage)
      markQuestionsAnswered();

      // optional: you can send answers to backend later if needed
      // await fetch("/api/questions", ...)

      router.push("/share");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Step indicator (overall flow: 4 steps) */}
        <div className="flex justify-center mb-4">
          <div className="text-sm text-zinc-500">
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600/30 align-middle ml-2" />
            خطوة 2 من 4
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs text-zinc-500">
                سؤال {step + 1} من {questions.length}
              </div>
              <h1 className="text-xl font-extrabold text-zinc-900 mt-1">
                أسئلة سريعة 🎯
              </h1>
            </div>

            <div className="h-10 w-10 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center">
              <span className="text-lg">🧠</span>
            </div>
          </div>

          {/* Question card */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 mb-4">
            <div className="text-lg font-bold text-zinc-900">{current?.title}</div>
            {current?.subtitle ? (
              <div className="text-sm text-zinc-600 mt-1">{current.subtitle}</div>
            ) : null}
          </div>

          {/* Choices */}
          <div className="space-y-3">
            {current?.choices.map((c) => {
              const selected = answers[current.id] === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  disabled={saving}
                  onClick={() => onPick(c.value)}
                  className={[
                    "w-full text-right rounded-2xl px-4 py-4 border transition shadow-sm",
                    "flex items-center justify-between gap-3",
                    selected
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-zinc-900 border-zinc-200 hover:border-purple-300 hover:bg-purple-50",
                    saving ? "opacity-70 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  <span className="font-semibold">{c.label}</span>
                  <span className="text-lg">{selected ? "✅" : "➡️"}</span>
                </button>
              );
            })}
          </div>

          {/* Footer helper */}
          <div className="mt-5 text-center text-xs text-zinc-500">
            {saving ? "جارٍ المتابعة..." : "اضغط على الإجابة للانتقال للسؤال التالي"}
          </div>

          {/* Back (optional) */}
          <div className="mt-4 flex justify-between items-center">
            <button
              type="button"
              onClick={() => router.push("/start")}
              className="text-sm text-zinc-500 hover:text-zinc-700 underline underline-offset-4"
            >
              رجوع
            </button>

            <div className="text-xs text-zinc-400">
              رقمك محفوظ ✅
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}