
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
  houseNumber: string;
  address: string;
  city: string;
  selectedDate: Date | undefined;
  selectedTime: string;
  specialInstructions: string;
  proceedToPayment?: boolean;
}
