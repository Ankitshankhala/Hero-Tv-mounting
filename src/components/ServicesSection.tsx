
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InlineBookingFlow } from '@/components/InlineBookingFlow';
import { ShoppingCart, Clock, Star, CheckCircle, Plus, Minus } from 'lucide-react';
import { CartItem } from '@/types';

const services = [
  {
    id: 'tv-mounting',
    name: 'TV Wall Mounting',
    description: 'Professional TV mounting service with cable management and setup',
    price: 149,
    duration: '1-2 hours',
    image: '/lovable-uploads/7b4fb46c-95b3-47dc-8002-6ea7d8db0c15.png',
    rating: 4.9,
    reviews: 127,
    features: ['Wall mounting', 'Cable management', 'Testing & setup']
  },
  {
    id: 'furniture-assembly',
    name: 'Furniture Assembly',
    description: 'Expert assembly for all types of furniture from beds to wardrobes',
    price: 89,
    duration: '1-3 hours',
    image: '/lovable-uploads/9c5c0e34-2a89-4b89-89a8-c5098f0d3e91.png',
    rating: 4.8,
    reviews: 203,
    features: ['Any furniture type', 'Tool included', 'Cleanup service']
  },
  {
    id: 'home-repairs',
    name: 'Home Repairs',
    description: 'General home repair services including drywall, painting, and fixes',
    price: 120,
    duration: '1-4 hours',
    image: '/lovable-uploads/4c3e8b95-8b47-4e89-9a2c-7d1e5f8c9b2a.png',
    rating: 4.7,
    reviews: 89,
    features: ['Drywall repair', 'Touch-up painting', 'Minor fixes']
  }
];

interface ServicesSectionProps {
  onAddToCart: (item: CartItem) => void;
}

export const ServicesSection = ({ onAddToCart }: ServicesSectionProps) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showBookingFlow, setShowBookingFlow] = useState(false);

  const handleAddToCart = (service: any, quantity: number = 1) => {
    const cartItem: CartItem = {
      id: service.id,
      name: service.name,
      price: service.price,
      quantity: quantity
    };

    setCart(prev => {
      const existing = prev.find(item => item.id === service.id);
      if (existing) {
        return prev.map(item => 
          item.id === service.id 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prev, cartItem];
      }
    });

    onAddToCart(cartItem);
  };

  const handleBookNow = (service: any) => {
    // Add service to cart if not already added
    const existingInCart = cart.find(item => item.id === service.id);
    if (!existingInCart) {
      handleAddToCart(service, 1);
    }
    
    // Open booking flow with the service
    const serviceForBooking = [{
      id: service.id,
      name: service.name,
      price: service.price,
      quantity: existingInCart ? existingInCart.quantity : 1
    }];
    
    setShowBookingFlow(true);
  };

  const handleQuantityChange = (serviceId: string, change: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === serviceId) {
        const newQuantity = Math.max(0, item.quantity + change);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-transparent to-purple-900/30" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-blue-500/30 rounded-full px-6 py-2 mb-6">
            <Star className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-medium text-blue-200">Trusted by 1000+ customers</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Professional Services
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Expert technicians ready to help with your home and office needs. Quality service guaranteed.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {services.map((service) => {
            const cartItem = cart.find(item => item.id === service.id);
            const quantity = cartItem?.quantity || 0;

            return (
              <Card 
                key={service.id} 
                className="group bg-white/10 backdrop-blur-xl border border-white/20 hover:border-white/40 transition-all duration-500 hover:transform hover:scale-[1.02] shadow-2xl hover:shadow-blue-500/20 overflow-hidden"
              >
                <div className="relative">
                  <img 
                    src={service.image} 
                    alt={service.name}
                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-green-600 text-white border-0 shadow-lg">
                      <Clock className="h-3 w-3 mr-1" />
                      {service.duration}
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-blue-600 text-white border-0 shadow-lg">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {service.rating}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                      {service.name}
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {service.description}
                    </p>
                  </div>

                  {/* Features */}
                  <div className="space-y-2">
                    {service.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-slate-300">
                        <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Reviews */}
                  <div className="flex items-center space-x-2 text-sm text-slate-400 border-t border-white/10 pt-3">
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-current" />
                      ))}
                    </div>
                    <span>({service.reviews} reviews)</span>
                  </div>

                  {/* Price and Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="text-2xl font-bold text-green-400">
                      ${service.price}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {quantity > 0 ? (
                        <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleQuantityChange(service.id, -1)}
                            className="h-8 w-8 p-0 text-white hover:bg-white/20"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="text-white font-bold min-w-[1.5rem] text-center">
                            {quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleQuantityChange(service.id, 1)}
                            className="h-8 w-8 p-0 text-white hover:bg-white/20"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleAddToCart(service, 1)}
                          variant="outline"
                          size="sm"
                          className="border-white/30 text-white hover:bg-white/10 hover:border-white/50"
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => handleBookNow(service)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        Book Now
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Cart Summary */}
        {cart.length > 0 && (
          <div className="flex justify-center">
            <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl max-w-md w-full">
              <CardContent className="p-6">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Your Cart ({cart.length})
                </h3>
                <div className="space-y-3 mb-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <span className="text-slate-300">{item.name} (x{item.quantity})</span>
                      <span className="text-green-400 font-bold">${item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/20 pt-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold">Total:</span>
                    <span className="text-green-400 font-bold text-xl">
                      ${cart.reduce((total, item) => total + (item.price * item.quantity), 0)}
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowBookingFlow(true)}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Book All Services
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Inline Booking Flow */}
      <InlineBookingFlow
        isOpen={showBookingFlow}
        onClose={() => setShowBookingFlow(false)}
        selectedServices={cart}
      />
    </section>
  );
};
