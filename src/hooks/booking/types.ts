
export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: Record<string, any>;
}

export interface FormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  zipcode: string;
  address: string;
  city: string;
  region: string;
  selectedDate: Date | undefined;
  selectedTime: string;
  specialInstructions: string;
}
