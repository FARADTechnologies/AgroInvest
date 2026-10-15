"use client";

import { useQuery } from "@tanstack/react-query";

// Weather for a plot from Open-Meteo (free, no key). Purely informational: when
// the network or the service is unavailable the widget hides itself.

export type Forecast = {
  current: { temperature: number; wind: number; humidity: number; code: number };
  daily: { date: string; code: number; max: number; min: number; rain: number }[];
};

type Raw = {
  current: { temperature_2m: number; wind_speed_10m: number; relative_humidity_2m: number; weather_code: number };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
};

export function useForecast(point: [number, number] | null | undefined) {
  // Round to ~1 km so neighbouring plots share one request.
  const lon = point ? Math.round(point[0] * 100) / 100 : null;
  const lat = point ? Math.round(point[1] * 100) / 100 : null;
  return useQuery({
    queryKey: ["forecast", lat, lon],
    enabled: lat !== null && lon !== null,
    staleTime: 30 * 60_000,
    retry: 0,
    queryFn: async ({ signal }): Promise<Forecast> => {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: "temperature_2m,wind_speed_10m,relative_humidity_2m,weather_code",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
        timezone: "Asia/Baku",
        forecast_days: "7",
        wind_speed_unit: "ms"
      });
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
      if (!r.ok) throw new Error(String(r.status));
      const raw = (await r.json()) as Raw;
      return {
        current: {
          temperature: raw.current.temperature_2m,
          wind: raw.current.wind_speed_10m,
          humidity: raw.current.relative_humidity_2m,
          code: raw.current.weather_code
        },
        daily: raw.daily.time.map((date, i) => ({
          date,
          code: raw.daily.weather_code[i],
          max: raw.daily.temperature_2m_max[i],
          min: raw.daily.temperature_2m_min[i],
          rain: raw.daily.precipitation_sum[i]
        }))
      };
    }
  });
}
