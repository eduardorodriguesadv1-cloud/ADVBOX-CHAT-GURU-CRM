import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhone(phone?: string) {
  if (!phone) return "Desconhecido";
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.length === 12 || cleaned.length === 13) {
    let ddd = cleaned.substring(cleaned.length === 12 ? 0 : 2, cleaned.length === 12 ? 2 : 4);
    let firstPart = cleaned.substring(cleaned.length === 12 ? 2 : 4, cleaned.length === 12 ? 7 : 9);
    let secondPart = cleaned.substring(cleaned.length === 12 ? 7 : 9);
    
    if (cleaned.length === 13 && cleaned.startsWith("55")) {
      return `(${ddd}) ${firstPart}-${secondPart}`;
    } else if (cleaned.length === 11) {
      return `(${cleaned.substring(0,2)}) ${cleaned.substring(2,7)}-${cleaned.substring(7)}`;
    }
  }
  
  if (cleaned.length >= 10 && cleaned.length <= 11) {
     return `(${cleaned.substring(0,2)}) ${cleaned.substring(2, cleaned.length - 4)}-${cleaned.substring(cleaned.length - 4)}`;
  }
  
  return phone;
}

export function formatDate(dateString?: string) {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch (e) {
    return dateString;
  }
}
