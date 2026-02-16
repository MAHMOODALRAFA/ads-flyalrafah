"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getRefCode,
  getShareCount,
  isUnlocked,
  REQUIRED_SHARES,
  computeDiscountAmount,
  getOrCreateDiscountCode,
} from "./referral";

export function useReferral() {
  const [refCode, setRefCode] = useState("");
  const [shareCount, setShareCount] = useState(0);
  const [discountCode, setDiscountCode] = useState("");

  function refresh() {
    const sc = getShareCount();
    setShareCount(sc);

    setRefCode(getRefCode());
    setDiscountCode(getOrCreateDiscountCode());
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlocked = useMemo(() => isUnlocked(), [shareCount]);
  const remaining = useMemo(
    () => Math.max(0, REQUIRED_SHARES - Math.min(shareCount, REQUIRED_SHARES)),
    [shareCount]
  );

  const discountAmount = useMemo(() => computeDiscountAmount(shareCount), [shareCount]);

  return {
    refCode,
    shareCount,
    discountCode,
    unlocked,
    remaining,
    discountAmount,
    refresh,
  };
}
