// app/questions/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPhone,
  hasAnsweredQuestions,
  markQuestionsAnswered,
  setPhone,
} from "../lib/referral";

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
    };

type CheckResponse =
  | {
      ok: true;
      user: {
        phone: string;
        destination: string | null;
        refCode: string;
        points: number;
        sharesGiven?: number;
      };
    }
  | { ok: false; error: string };

const ANSWERS_KEY_PREFIX = "flyalrafah_questions_answers__";

function answersKey(phone: string) {
  return `${ANSWERS_KEY_PREFIX}${phone || "unknown"}`;
}

function readFormDestination(): { value: string; label: string } {
  const fallback = { value: "shiraz", label: "شيراز" };
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem("flyalrafah_form");
    if (!raw) return fallback;

    const obj = JSON.parse(raw) as { destination?: string };
    const value = String(obj.destination || "").trim();

    const map: Record<string, string> = {
      shiraz: "شيراز",
      tehran: "طهران",
      mashhad: "مشهد",
      chabahar: "جابهار",
      kish: "جزيرة كيش",
      "bandar-abbas": "بندر عباس",
      ahvaz: "الأهواز",
    };

    return { value: value || fallback.value, label: map[value] || fallback.label };
  } catch {
    return fallback;
  }
}

export default function QuestionsPage() {
  const router = useRouter();

  const dest = useMemo(() => readFormDestination(), []);
  const [phone, setPhoneState] = useState<string>("");

  const [booting, setBooting] = useState(true);
  const [step, setStep] = useState(0); // 0..1
  const [saving, setSaving] = useState(false);

  // ✅ Session-first guard
  useEffect(() => {
    // ✅ اگر لوکال میگه جواب داده شده، مستقیم برو status (نه share)
    if (hasAnsweredQuestions()) {
      router.replace("/status");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setBooting(true);

        const res = await fetch("/api/check", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        });

        const data = (await res.json().catch(() => null)) as CheckResponse | null;
        if (cancelled) return;

        if (!res.ok || !data || data.ok === false) {
          router.replace("/start");
          return;
        }

        // sync local phone marker for guards/keys
        setPhone(data.user.phone);
        setPhoneState(data.user.phone || "");

        // ✅ اگر سرور میگه مقصد ثبت شده => یعنی سوالات قبلاً جواب داده شده
        if (data.user.destination) {
          markQuestionsAnswered(); // sync local UX
          router.replace("/status");
          return;
        }

        // اگر وسط راه قبلاً جواب داده بود (local) الان هم ok هست، مستقیم برو status
        if (hasAnsweredQuestions()) {
          router.replace("/status");
          return;
        }

        // stay on questions
      } catch {
        if (!cancelled) router.replace("/start");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const questions: Question[] = useMemo(() => {
    const city = dest.label;

    return [
      {
        id: "q1",
        title: `هل سافرت إلى ${city} من قبل؟ 🇮🇷✈️`,
        subtitle: "اختيارك يساعدنا نفهم اهتمامك بالتجربة",
        type: "single",
        choices: [
          { value: "yes", label: "نعم، سافرت قبل" },
          { value: "no", label: "لا، أول مرة" },
          { value: "planning", label: "أخطط قريباً" },
        ],
      },
      {
        id: "q2",
        title: `إذا سافرت إلى ${city}، أي نوع رحلة كانت / بتكون؟ 🎯`,
        subtitle: "اختيار واحد",
        type: "single",
        choices: [
          { value: "tourism", label: "سياحة واستمتاع" },
          { value: "medical", label: "علاج / طبي" },
          { value: "business", label: "عمل / تجارة" },
          { value: "family", label: "زيارة أهل / عائلة" },
          { value: "religious", label: "دينية / زيارة" },
          { value: "study", label: "دراسة / تدريب" },
          { value: "other", label: "سبب آخر" },
        ],
      },
    ];
  }, [dest.label]);

  const current = questions[step];

  function readSavedAnswers(currentPhone: string): Record<string, string> {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(answersKey(currentPhone));
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  function writeSavedAnswers(currentPhone: string, next: Record<string, string>) {
    if (typeof window === "undefined") return;
    localStorage.setItem(answersKey(currentPhone), JSON.stringify(next));
  }

  const [answers, setAnswers] = useState<Record<string, string>>({});

  // load answers after phone is known
  useEffect(() => {
    if (!phone) return;
    setAnswers(readSavedAnswers(phone));
  }, [phone]);

  async function saveAnswersToDb(nextAnswers: Record<string, string>) {
    // لا نكسر الفلو إذا فشل الحفظ
    try {
      const q1 = String(nextAnswers.q1 || "").trim();
      const q2 = String(nextAnswers.q2 || "").trim();
      if (!q1 || !q2) return;

      await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ keep phone for backward compatibility (current API)
        body: JSON.stringify({
          phone: phone || getPhone(),
          destination: dest.value,
          q1,
          q2,
        }),
      });
    } catch {
      // ignore
    }
  }

  async function onPick(choiceValue: string) {
    if (!current) return;
    if (saving) return;

    const next = { ...answers, [current.id]: choiceValue };
    setAnswers(next);

    if (phone) writeSavedAnswers(phone, next);

    if (step < questions.length - 1) {
      setSaving(true);
      window.setTimeout(() => {
        setStep((s) => s + 1);
        setSaving(false);
      }, 250);
      return;
    }

    try {
      setSaving(true);

      // ✅ حفظ الإجابات في DB (غير مُعطّل للفلو)
      await saveAnswersToDb(next);

      // ✅ mark answered (local UX)
      markQuestionsAnswered();

      // ✅ بعد الإجابة نروح status حسب طلبك
      router.push("/status");
    } finally {
      setSaving(false);
    }
  }

  if (booting) {
    return (
      <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="text-lg font-extrabold text-zinc-900">جارٍ التحميل...</div>
          <div className="text-sm text-zinc-500 mt-2">نجهّز الأسئلة</div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-purple-600" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-4">
          <div className="text-sm text-zinc-500">
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600 align-middle ml-2" />
            <span className="inline-block h-2 w-10 rounded-full bg-purple-600/30 align-middle ml-2" />
            خطوة 2 من 4
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs text-zinc-500">
                سؤال {step + 1} من {questions.length}
              </div>
              <h1 className="text-xl font-extrabold text-zinc-900 mt-1">أسئلة سريعة 🎯</h1>
              <div className="text-xs text-zinc-500 mt-1">
                المدينة المختارة: <span className="font-bold">{dest.label}</span>
              </div>
            </div>

            <div className="h-10 w-10 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center">
              <span className="text-lg">🧠</span>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 mb-4">
            <div className="text-lg font-bold text-zinc-900">{current?.title}</div>
            {current?.subtitle ? (
              <div className="text-sm text-zinc-600 mt-1">{current.subtitle}</div>
            ) : null}
          </div>

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

          <div className="mt-5 text-center text-xs text-zinc-500">
            {saving ? "جارٍ المتابعة..." : "اضغط على الإجابة للانتقال للسؤال التالي"}
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button
              type="button"
              onClick={() => router.push("/start")}
              className="text-sm text-zinc-500 hover:text-zinc-700 underline underline-offset-4"
            >
              رجوع
            </button>

            <div className="text-xs text-zinc-400">رقمك محفوظ ✅</div>
          </div>
        </div>
      </div>
    </main>
  );
}