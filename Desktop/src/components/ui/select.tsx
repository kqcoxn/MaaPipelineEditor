import { useEffect, useState, type ComponentProps } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  children,
  className,
  size = "default",
  variant = "default",
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "default" | "compact";
  variant?: "default" | "inline";
}) {
  return (
    <SelectPrimitive.Trigger
      className={cn("select-trigger", className)}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  children,
  className,
  width = "trigger",
  ...props
}: ComponentProps<typeof SelectPrimitive.Content> & {
  width?: "trigger" | "wide";
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  // Keep the popup outside the dock's backdrop-filter, inside the app's theme.
  useEffect(
    () => setContainer(document.querySelector<HTMLElement>(".app")),
    [],
  );
  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={10}
        collisionPadding={16}
        className={cn("select-content", className)}
        data-width={width}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="select-scroll-button">
          <ChevronUp aria-hidden="true" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="select-viewport">
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="select-scroll-button">
          <ChevronDown aria-hidden="true" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  children,
  description,
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item> & { description?: string }) {
  return (
    <SelectPrimitive.Item className={cn("select-item", className)} {...props}>
      <span className="select-item-copy">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description && (
          <span className="select-item-description">{description}</span>
        )}
      </span>
      <SelectPrimitive.ItemIndicator className="select-item-indicator">
        <Check aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
