import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString('en-IN')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d');
  } catch {
    return dateStr;
  }
}

export function formatDateFull(dateStr) {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatTime(timeStr) {
  if (!timeStr) return '—';
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayH}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
}

export function formatRelativeDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getTodayFormatted() {
  return format(new Date(), 'EEEE, MMMM d, yyyy');
}

export function getStatusBadgeClass(status) {
  const map = {
    'Confirmed': 'badge-confirmed',
    'Waiting': 'badge-waiting',
    'In Treatment': 'badge-in-treatment',
    'Completed': 'badge-completed',
    'Cancelled': 'badge-cancelled',
    'No-show': 'badge-no-show'
  };
  return map[status] || 'badge-confirmed';
}

export function validatePhone(phone) {
  return /^[6-9]\d{9}$/.test(phone?.replace(/\s/g, ''));
}

export function validateRequired(value) {
  return value && value.toString().trim().length > 0;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
