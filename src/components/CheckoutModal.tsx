
import React, { useState } from 'react';
import { X, CreditCard, MapPin, MessageSquare } from 'lucide-react';
import { CartItem } from '@/pages/Index';

interface CheckoutModalProps {
  cart: CartItem[];
  total: number;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ cart, total, onClose }) => {
  const [zipCode, setZipCode] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for payment processing
    console.log('Processing payment...', { cart, total, zipCode, email, phone });
    // Placeholder for worker assignment
    console.log('Assigning worker for ZIP:', zipCode);
    // Placeholder for SMS notification
    console.log('Sending SMS notification to worker...');
    alert('Order placed successfully! You will receive a confirmation email shortly.');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-3xl font-black text-white">Checkout</h3>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <h4 className="text-xl font-black text-white mb-4 flex items-center uppercase tracking-wide">
                  <MapPin className="h-6 w-6 mr-2 text-blue-400" />
                  Service Location
                </h4>
                <input
                  type="text"
                  placeholder="ZIP Code"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-white mb-2 font-semibold">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-white mb-2 font-semibold">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-white mb-2 font-semibold">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            
            <div>
              <h4 className="text-xl font-black text-white mb-4 flex items-center uppercase tracking-wide">
                <CreditCard className="h-6 w-6 mr-2 text-blue-400" />
                Payment Information
              </h4>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Card Number"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="text"
                    placeholder="CVV"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800 rounded-lg p-6">
              <h4 className="text-2xl font-black text-white mb-4 uppercase tracking-wide">Order Summary</h4>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between text-slate-300">
                    <span>{item.name} x{item.quantity}</span>
                    <span>${item.price * item.quantity}</span>
                  </div>
                ))}
                <div className="border-t border-slate-600 pt-2 mt-2">
                  <div className="flex justify-between text-xl font-black text-white">
                    <span>Total:</span>
                    <span className="text-blue-400">${total}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <MessageSquare className="h-5 w-5 text-blue-400 mt-1" />
                <div>
                  <h5 className="text-white font-bold mb-1">What happens next?</h5>
                  <p className="text-slate-300 text-sm">
                    We'll assign a local technician and send you an SMS with their contact info and estimated arrival time.
                  </p>
                </div>
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors duration-200 text-lg"
            >
              Complete Order - ${total}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
