export const SCRAPING_PERIODS = [
  { value: "1d", label: "1 Hari", days: 1, maxReviews: 20 },
  { value: "1w", label: "1 Minggu", days: 7, maxReviews: 100 },
  { value: "1m", label: "1 Bulan", days: 30, maxReviews: 300 },
  { value: "3m", label: "3 Bulan", days: 90, maxReviews: 500 },
  { value: "6m", label: "6 Bulan", days: 180, maxReviews: 750 },
  { value: "1y", label: "1 Tahun", days: 365, maxReviews: 1000 },
  { value: "2y", label: "2 Tahun", days: 730, maxReviews: 2000 },
  { value: "3y", label: "3 Tahun", days: 1095, maxReviews: 3000 },
] as const;

export type PeriodeScraping = (typeof SCRAPING_PERIODS)[number]["value"];

export function isPeriodeScraping(value: unknown): value is PeriodeScraping {
  return SCRAPING_PERIODS.some((period) => period.value === value);
}
