"use client";

import * as React from "react";
import { DayPicker, type ChevronProps } from "react-day-picker";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { id as localeId } from "date-fns/locale";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = localeId,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      className={cn("p-2.5 bg-card rounded-xl border shadow-xs text-xs", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-3 sm:space-x-3 sm:space-y-0",
        month: "space-y-3",
        month_caption: "flex justify-center pt-0.5 relative items-center px-1 text-xs font-semibold h-7 text-foreground",
        caption_label: "text-xs font-semibold flex items-center gap-1",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-6 w-6 bg-background hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 p-0 opacity-70 hover:opacity-100 absolute left-1 z-10 transition-all duration-150 rounded-full"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-6 w-6 bg-background hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 p-0 opacity-70 hover:opacity-100 absolute right-1 z-10 transition-all duration-150 rounded-full"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex w-full justify-between border-b border-border/50 pb-1 mb-1",
        weekday:
          "text-muted-foreground rounded-full w-7 h-6 font-semibold text-[0.7rem] text-center flex items-center justify-center uppercase tracking-wider",
        week: "flex w-full mt-1 justify-between",
        day: "h-7 w-7 text-center text-xs p-0 relative flex items-center justify-center focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 p-0 text-xs font-normal aria-selected:opacity-100 rounded-full transition-all duration-150 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 hover:scale-105 active:scale-95 aria-disabled:pointer-events-none aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:scale-100 aria-disabled:text-slate-400 dark:aria-disabled:text-slate-600"
        ),
        selected:
          "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white font-semibold rounded-full shadow-xs transition-transform duration-150 scale-105 z-10",
        range_start: "bg-blue-600 text-white rounded-l-full font-semibold shadow-xs z-10",
        range_end: "bg-blue-600 text-white rounded-r-full font-semibold shadow-xs z-10",
        range_middle: "bg-blue-100 text-blue-900 dark:bg-blue-950/70 dark:text-blue-200 rounded-none font-medium",
        today: "bg-blue-50 text-blue-700 font-bold rounded-full ring-1 ring-blue-500/40 dark:bg-blue-950/50 dark:text-blue-300",
        outside:
          "text-slate-300 dark:text-slate-700 opacity-40 aria-selected:bg-blue-100/50 aria-selected:text-blue-900",
        disabled: "text-slate-400 dark:text-slate-600 bg-slate-100/40 dark:bg-slate-900/30 opacity-50 cursor-not-allowed pointer-events-none rounded-full",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }: ChevronProps) => {
          if (orientation === "left") {
            return <CaretLeft className="size-3.5 text-foreground" />;
          }
          return <CaretRight className="size-3.5 text-foreground" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
