import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:border-2 border-transparent focus-visible:border-primary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-card text-card-foreground hover:bg-card/60",
        ghost: "hover:bg-accent hover:text-accent-foreground outline-none",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[34px] px-3 py-1.5",
        sm: "h-7 rounded-sm px-2.5",
        lg: "h-10 rounded-md px-6",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

