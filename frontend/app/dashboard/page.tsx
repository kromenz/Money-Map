"use client";

import useRequireAuth from "../../src/hooks/useRequireAuth";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth("/");

  if (loading || !user) {
    return null;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p>Your protected content here.</p>
    </div>
  );
}
