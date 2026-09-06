"use client";

import * as React from "react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "@phosphor-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTanggal, type AnalisisItem } from "@/lib/types";

interface PropsSelect {
  daftar: AnalisisItem[];
  dipilih: number | null;
  onChange: (id: number) => void;
  hanyaSelesai?: boolean;
}

export function PilihPeriode({ daftar, dipilih, onChange, hanyaSelesai = true }: PropsSelect) {
  const opsi = hanyaSelesai ? daftar.filter((a) => a.status === "selesai") : daftar;

  if (opsi.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full max-w-sm h-9 text-xs">
          <SelectValue placeholder="Belum ada periode analisis" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={dipilih ? String(dipilih) : ""}
      onValueChange={(val) => onChange(Number(val))}
    >
      <SelectTrigger className="w-full max-w-sm bg-card shadow-xs h-9 text-xs">
        <SelectValue placeholder="Pilih Periode Analisis" />
      </SelectTrigger>
      <SelectContent align="end">
        {opsi.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {formatTanggal(item.tanggalUnggah)} · {item.namaFile} ({item.totalUlasan} ulasan)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface PropsRentang {
  dateRange: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function PilihPeriodeRentang({ dateRange, onChange, className }: PropsRentang) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 px-3 gap-2 text-xs font-medium bg-card justify-start text-left shadow-2xs border-input min-w-[240px] transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20",
              dateRange?.from
                ? "border-blue-500 bg-blue-50/50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-200 ring-2 ring-blue-500/10 font-semibold"
                : "text-muted-foreground"
            )}
          >
            <CalendarIcon className={cn("size-3.5 shrink-0 transition-colors", dateRange?.from ? "text-blue-600" : "text-muted-foreground")} />
            <span className="truncate">
              {dateRange?.from ? (
                dateRange.to ? (
                  `${format(dateRange.from, "dd MMM yyyy", { locale: localeId })} - ${format(dateRange.to, "dd MMM yyyy", { locale: localeId })}`
                ) : (
                  format(dateRange.from, "dd MMM yyyy", { locale: localeId })
                )
              ) : (
                "Pilih Rentang Tanggal"
              )}
            </span>
            {dateRange?.from && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined);
                }}
                className="ml-auto p-0.5 rounded hover:bg-blue-100 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <X className="size-3" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border shadow-lg animate-in fade-in-0 zoom-in-95 duration-200" align="end">
          <div className="px-3 py-2 border-b flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20">
            <span>Filter Rentang Tanggal</span>
          </div>
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onChange}
            disabled={{ after: new Date() }}
            numberOfMonths={1}
            className="p-2.5 border-0 shadow-none"
            captionLayout="dropdown"
          />
          <div className="p-2 border-t flex justify-end gap-2 bg-muted/20">
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-xs h-7 font-medium hover:bg-blue-50 hover:text-blue-600 transition-colors"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Tampilkan Semua Tanggal
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
