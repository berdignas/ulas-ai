"use client";

import * as React from "react";
import * as AlertDialogPrimitives from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";

const AlertDialog = AlertDialogPrimitives.Root;
const AlertDialogTrigger = AlertDialogPrimitives.Trigger;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitives.Content>
>(({ className, ...props }, ref) => (
  <>
    <AlertDialogPrimitives.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <AlertDialogPrimitives.Content
      ref={ref}
      className={cn(
        "fixed z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    />
  </>
));
AlertDialogContent.displayName = AlertDialogPrimitives.Content.displayName;

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitives.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitives.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitives.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitives.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitives.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitives.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitives.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitives.Action
    ref={ref}
    className={cn("btn-primary", className)}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitives.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitives.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitives.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitives.Cancel
    ref={ref}
    className={cn(
      "btn-outline mt-2 sm:mt-0",
      className
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitives.Cancel.displayName;

// Simple Alert components (not dialog)
const Alert = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "success" | "warning" | "danger" }
>(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative w-full rounded-lg border p-4",
      {
        "bg-emerald-50 border-emerald-200 text-emerald-900": variant === "success",
        "bg-amber-50 border-amber-200 text-amber-900": variant === "warning",
        "bg-rose-50 border-rose-200 text-rose-900": variant === "danger",
        "bg-background border-border": variant === "default",
      },
      className
    )}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  React.ElementRef<"h5">,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  Alert,
  AlertTitle,
  AlertDescription,
};