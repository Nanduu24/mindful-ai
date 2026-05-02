// src/app/(dashboard)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { MessageSquare, Calendar, TrendingUp, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardData {
  user: {
    subscription_tier: string;
    member_since: string;
  };
  stats: {
    sessions_this_month: number;
    total_sessions: number;
    total_messages: number;
  };
  mood_logs: { score: number; created_at: string }[];
  recent_sessions: {
    id: string;
    title: string;
    created_at: string;
    message_count: number;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [moodScore, setMoodScore] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      setData(json);
    } catch {
      console.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleLogMood = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: moodScore }),
      });
      await fetchDashboard();
    } catch {
      console.error("Failed to log mood");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading dashboard...
      </div>
    );
  }

  if (!data) return null;

  const moodChartData = data.mood_logs.map((log) => ({
    date: format(parseISO(log.created_at), "MMM d"),
    score: log.score,
  }));

  const avgMood = data.mood_logs.length
    ? (
        data.mood_logs.reduce((sum, l) => sum + l.score, 0) /
        data.mood_logs.length
      ).toFixed(1)
    : "—";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Welcome back
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {data.user.subscription_tier === "free"
                ? "Free plan"
                : `${data.user.subscription_tier.charAt(0).toUpperCase()}${data.user.subscription_tier.slice(1)} plan`}{" "}
              · Member since{" "}
              {format(parseISO(data.user.member_since), "MMM d, yyyy")}
            </p>
          </div>
          <Button onClick={() => router.push("/chat")}>New session →</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<MessageSquare className="w-4 h-4" />}
            label="Sessions this month"
            value={data.stats.sessions_this_month.toString()}
          />
          <StatCard
            icon={<Calendar className="w-4 h-4" />}
            label="Total sessions"
            value={data.stats.total_sessions.toString()}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Total messages"
            value={data.stats.total_messages.toString()}
          />
          <StatCard
            icon={<Heart className="w-4 h-4" />}
            label="Average mood"
            value={`${avgMood} / 10`}
          />
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            Mood — last 30 days
          </h2>
          {moodChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">
              Log your first mood below to see your trend
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={moodChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis domain={[1, 10]} stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#0d9488"
                  strokeWidth={2}
                  dot={{ fill: "#0d9488", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-1">
              How are you feeling right now?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Log your mood — takes 5 seconds
            </p>
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setMoodScore(n)}
                  className={cn(
                    "w-8 h-8 rounded-full text-xs font-medium transition-all",
                    moodScore === n
                      ? "bg-teal-600 text-white scale-110"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-4">
              <span>Very low</span>
              <span>Very good</span>
            </div>
            <Button
              className="w-full"
              onClick={handleLogMood}
              disabled={submitting}
            >
              {submitting ? "Logging..." : "Log mood"}
            </Button>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Recent sessions</h2>
            {data.recent_sessions.length === 0 ? (
              <p className="text-sm text-gray-400">No sessions yet</p>
            ) : (
              <div className="space-y-2">
                {data.recent_sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => router.push(`/chat`)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {s.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(parseISO(s.created_at), "MMM d, h:mm a")} ·{" "}
                      {s.message_count} messages
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}