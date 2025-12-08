"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface OTPInputContextValue {
  slots: Array<{ char: string; hasFakeCaret: boolean; isActive: boolean }>
  value: string
  setValue: (value: string) => void
  maxLength: number
}

const OTPInputContext = React.createContext<OTPInputContextValue | null>(null)

interface OTPInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  maxLength?: number
  value?: string
  onChange?: (value: string) => void
  containerClassName?: string
}

const OTPInput = React.forwardRef<HTMLInputElement, OTPInputProps>(
  ({ className, containerClassName, maxLength = 6, value = '', onChange, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value)
    const [activeIndex, setActiveIndex] = React.useState(0)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value.replace(/\D/g, '').slice(0, maxLength)
      setInternalValue(newValue)
      onChange?.(newValue)
      // Update active index based on cursor position
      const cursorPos = e.target.selectionStart || newValue.length
      setActiveIndex(Math.min(cursorPos, maxLength - 1))
    }

    React.useEffect(() => {
      setInternalValue(value)
      setActiveIndex(Math.min(value.length, maxLength - 1))
    }, [value, maxLength])

    // Update active index when input is focused or cursor moves
    React.useEffect(() => {
      const input = inputRef.current
      if (!input) return

      const updateActiveIndex = () => {
        const cursorPos = input.selectionStart || internalValue.length
        setActiveIndex(Math.min(cursorPos, maxLength - 1))
      }

      input.addEventListener('focus', updateActiveIndex)
      input.addEventListener('click', updateActiveIndex)
      input.addEventListener('keyup', updateActiveIndex)

      return () => {
        input.removeEventListener('focus', updateActiveIndex)
        input.removeEventListener('click', updateActiveIndex)
        input.removeEventListener('keyup', updateActiveIndex)
      }
    }, [internalValue.length, maxLength])

    const slots = Array.from({ length: maxLength }, (_, i) => ({
      char: internalValue[i] || '',
      hasFakeCaret: activeIndex === i && document.activeElement === inputRef.current,
      isActive: activeIndex === i,
    }))

    const contextValue: OTPInputContextValue = {
      slots,
      value: internalValue,
      setValue: (val) => {
        setInternalValue(val)
        onChange?.(val)
      },
      maxLength,
    }

    // Focus input when container is clicked
    const handleContainerClick = (e: React.MouseEvent) => {
      // Only focus if clicking on the container itself, not on a slot
      if (e.target === containerRef.current || (e.target as HTMLElement).closest('[data-otp-slot]') === null) {
        inputRef.current?.focus()
      }
    }

    // Auto-focus input when component mounts or step changes
    React.useEffect(() => {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }, [])

    return (
      <OTPInputContext.Provider value={contextValue}>
        <div 
          ref={containerRef}
          className={cn("relative", containerClassName)} 
          data-otp-container
          onClick={handleContainerClick}
          style={{ cursor: 'text' }}
        >
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={maxLength}
            value={internalValue}
            onChange={handleChange}
            onFocus={(e) => {
              const cursorPos = e.target.selectionStart || internalValue.length
              setActiveIndex(Math.min(cursorPos, maxLength - 1))
              props.onFocus?.(e)
            }}
            onKeyDown={(e) => {
              // Handle backspace
              if (e.key === 'Backspace' && internalValue.length > 0) {
                const newValue = internalValue.slice(0, -1)
                setInternalValue(newValue)
                onChange?.(newValue)
                setActiveIndex(Math.max(0, newValue.length - 1))
                // Prevent default to avoid cursor jumping
                e.preventDefault()
              }
              props.onKeyDown?.(e)
            }}
            onInput={(e) => {
              // Ensure cursor position is tracked
              const target = e.target as HTMLInputElement
              const cursorPos = target.selectionStart || internalValue.length
              setActiveIndex(Math.min(cursorPos, maxLength - 1))
            }}
            className={cn(
              "absolute opacity-0 w-full h-full left-0 top-0 z-50 cursor-text",
              className
            )}
            autoFocus
            tabIndex={0}
            style={{ 
              position: 'absolute',
              opacity: 0,
              width: '100%',
              height: '100%',
              left: 0,
              top: 0,
              zIndex: 50,
              cursor: 'text',
              background: 'transparent',
              border: 'none',
              outline: 'none',
            }}
            {...props}
          />
          {children}
        </div>
      </OTPInputContext.Provider>
    )
  }
)
OTPInput.displayName = "OTPInput"

const InputOTP = React.forwardRef<HTMLInputElement, OTPInputProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <OTPInput
      ref={ref}
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
)
InputOTP.displayName = "InputOTP"

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
))
InputOTPGroup.displayName = "InputOTPGroup"

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, onClick, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext)
  if (!inputOTPContext) {
    return null
  }
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index] || { char: '', hasFakeCaret: false, isActive: false }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation() // Prevent container click
    // Find the hidden input and focus it
    const container = e.currentTarget.closest('[data-otp-container]')
    const input = container?.querySelector('input[type="text"]') as HTMLInputElement
    if (input) {
      input.focus()
      // Move cursor to the clicked slot position or next available position
      const targetPos = Math.min(index, inputOTPContext.value.length)
      input.setSelectionRange(targetPos, targetPos)
    }
    onClick?.(e)
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      data-otp-slot
      className={cn(
        "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md cursor-text select-none pointer-events-auto",
        isActive && "z-10 ring-2 ring-ring ring-offset-background",
        className
      )}
      {...props}
    >
      <span className="text-lg font-medium pointer-events-none">{char}</span>
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  )
})
InputOTPSlot.displayName = "InputOTPSlot"

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <div className="h-1 w-1 rounded-full bg-border" />
  </div>
))
InputOTPSeparator.displayName = "InputOTPSeparator"

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }

