import type { ComponentType, SVGProps } from "react";
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight,
  Bell, BookOpen, Calendar, CalendarDays, Check, CheckCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleHelp, CircleUserRound,
  Clipboard, Clock, Copy, CreditCard, Download, Edit, ExternalLink, Eye, EyeOff, File, FileText, Filter, Flag, Folder, Gauge, Globe, HandCoins, HelpCircle,
  Home, Info, LayoutDashboard, LifeBuoy, Link, ListFilter, LoaderCircle, Lock, LogIn, LogOut, Mail, Menu, MessageCircle, Minus, Moon, MoreHorizontal,
  MoreVertical, Pencil, PieChart, Plus, RefreshCw, Repeat2, Search, Settings, Shield, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Sun, Trash2,
  TrendingDown, TrendingUp, Upload, User, UserCog, Users, Wallet, X, XCircle, type LucideProps
} from "lucide-react";

export const iconRegistry = {
  activity: Activity, "alert-circle": AlertCircle, "alert-triangle": AlertTriangle, "arrow-down": ArrowDown, "arrow-down-left": ArrowDownLeft,
  "arrow-down-right": ArrowDownRight, "arrow-left": ArrowLeft, "arrow-left-right": ArrowLeftRight, "arrow-right": ArrowRight, "arrow-up": ArrowUp,
  "arrow-up-left": ArrowUpLeft, "arrow-up-right": ArrowUpRight, bell: Bell, "book-open": BookOpen, calendar: Calendar, "calendar-days": CalendarDays,
  check: Check, "check-circle": CheckCircle, "check-circle-2": CheckCircle2, "chevron-down": ChevronDown, "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight, "chevron-up": ChevronUp, "circle-help": CircleHelp, "circle-user": CircleUserRound, clipboard: Clipboard, clock: Clock,
  copy: Copy, "credit-card": CreditCard, download: Download, edit: Edit, "external-link": ExternalLink, eye: Eye, "eye-off": EyeOff, file: File,
  "file-text": FileText, filter: Filter, flag: Flag, folder: Folder, gauge: Gauge, globe: Globe, "hand-coins": HandCoins, "help-circle": HelpCircle,
  home: Home, info: Info, "layout-dashboard": LayoutDashboard, "life-buoy": LifeBuoy, link: Link, "list-filter": ListFilter, loader: LoaderCircle,
  lock: Lock, "log-in": LogIn, "log-out": LogOut, mail: Mail, menu: Menu, "message-circle": MessageCircle, minus: Minus, moon: Moon,
  "more-horizontal": MoreHorizontal, "more-vertical": MoreVertical, pencil: Pencil, "pie-chart": PieChart, plus: Plus, "refresh-cw": RefreshCw,
  "repeat-2": Repeat2, search: Search, settings: Settings, shield: Shield, "shield-check": ShieldCheck, sliders: SlidersHorizontal,
  smartphone: Smartphone, sparkles: Sparkles, sun: Sun, trash: Trash2, "trending-down": TrendingDown, "trending-up": TrendingUp, upload: Upload,
  user: User, "user-cog": UserCog, users: Users, wallet: Wallet, x: X, "x-circle": XCircle
} satisfies Record<string, ComponentType<LucideProps>>;

export type IconName = keyof typeof iconRegistry;
export type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number; label?: string };

export function Icon({ name, size = 20, label, ...props }: IconProps) {
  const Glyph = iconRegistry[name];
  return <Glyph className={["ui-icon", props.className].filter(Boolean).join(" ")} size={size} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} {...props} />;
}
