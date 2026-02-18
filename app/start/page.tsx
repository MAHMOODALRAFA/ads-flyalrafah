"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hasStarted, setPhone } from "../lib/referral";

type Destination = { value: string; label: string };

export default function StartPage() {
  const router = useRouter();

  // ✅ Guard: إذا بدأ مسبقاً، لا تعرض النموذج
  useEffect(() => {
    if (hasStarted()) {
      router.replace("/share");
    }
  }, [router]);

  const destinations: Destination[] = useMemo(
    () => [
      { value: "shiraz", label: "شيراز" },
      { value: "tehran", label: "طهران" },
      { value: "chabahar", label: "جابهار" },
      { value: "kish", label: "جزيرة كيش" },
      { value: "bandar-abbas", label: "بندر عباس" },
      { value: "ahvaz", label: "الأهواز" },
    ],
    []
  );

  const [destination, setDestination] = useState(destinations[0]?.value ?? "");
  const [travelDate, setTravelDate] = useState("");
  const [passengers, setPassengers] = useState(1);

  // ✅ Oman prefix fixed
  const OMAN_PREFIX = "+968";
  const [whatsappLocal, setWhatsappLocal] = useState(""); // user enters only remaining digits

  function normalizeDigits(input: string) {
    // Persian/Arabic digits -> English digits
    const map: Record<string, string> = {
      "٠": "0",
      "١": "1",
      "٢": "2",
      "٣": "3",
      "٤": "4",
      "٥": "5",
      "٦": "6",
      "٧": "7",
      "٨": "8",
      "٩": "9",
      "۰": "0",
      "۱": "1",
      "۲": "2",
      "۳": "3",
      "۴": "4",
      "۵": "5",
      "۶": "6",
      "۷": "7",
      "۸": "8",
      "۹": "9",
    };
    return (input || "").replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
  }

  function cleanLocalDigits(input: string) {
    // keep digits only (no +)
    return normalizeDigits(input).replace(/[^\d]/g, "");
  }

  function isValidOmanWhatsapp(localDigits: string) {
    // Oman mobile numbers are typically 8 digits after +968
    const x = cleanLocalDigits(localDigits);
    return x.length === 8;
  }

  async function handleNext() {
    if (!travelDate) {
      alert("الرجاء اختيار تاريخ السفر");
      return;
    }

    if (!whatsappLocal || !isValidOmanWhatsapp(whatsappLocal)) {
      alert("الرجاء إدخال رقم واتساب عماني صحيح (8 أرقام)");
      return;
    }

    const local = cleanLocalDigits(whatsappLocal); // 8 digits
    const fullWithPlus = `${OMAN_PREFIX}${local}`; // +968XXXXXXXX
    const phoneDigits = fullWithPlus.replace(/\+/g, ""); // 968XXXXXXXX (digits only for API/storage)

    // ✅ Register in DB
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneDigits, // ✅ digits only
          name: "",
          destination,
        }),