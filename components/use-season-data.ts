"use client";
import { useEffect, useState } from "react";
import { emptySeason, type SeasonData } from "@/lib/data";
import { loadSeasonData } from "@/lib/season-data";

const cache = new Map<string, { data: SeasonData; fetchedAt: number }>();
export function useSeasonData(season: string, enabled = true) {
  const [data, setData] = useState<SeasonData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setError("");
    const cached = cache.get(season);
    if (cached && Date.now() - cached.fetchedAt < 60_000) {
      setData(cached.data);
      return;
    }
    loadSeasonData(season, controller.signal)
      .then((snapshot) => {
        cache.set(season, { data: snapshot, fetchedAt: Date.now() });
        setData(snapshot);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof TypeError
              ? "The season snapshot could not be downloaded. Check your connection and retry."
              : error instanceof Error
                ? error.message
                : "Season data could not be loaded. Please retry.",
          );
      });
    return () => controller.abort();
  }, [season, attempt, enabled]);
  const loaded = data?.metadata.id === season;
  return {
    data: loaded ? data : emptySeason,
    loaded,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
