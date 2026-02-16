import { Suspense } from "react";
import FriendClient from "./FriendClient";

export default function FriendPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <FriendClient />
    </Suspense>
  );
}
