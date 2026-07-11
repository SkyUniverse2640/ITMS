import {
  LayoutDashboard,
  Ticket,
  Package,
  Tags,
  Settings2,
  FileStack,
  Monitor,
  Mail,
  Palette,
  MapPin,
  Clock,
  Users,
  UserCog,
  Shield,
  Menu,
  Boxes,
  FileText,
  ScrollText,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Ticket,
  Package,
  Tags,
  Settings2,
  FileStack,
  Monitor,
  Mail,
  Palette,
  MapPin,
  Clock,
  Users,
  UserCog,
  Shield,
  Menu,
  Boxes,
  FileText,
  ScrollText,
  Building2,
};

/** Inherits theme color (dark in light mode, light in dark mode via parent / currentColor) */
export function NavIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = MAP[name] || LayoutDashboard;
  return (
    <Icon
      className={cn("shrink-0 stroke-[2.25] text-current", className)}
      aria-hidden
    />
  );
}
