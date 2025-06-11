
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Star } from 'lucide-react';

interface ServiceCardProps {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  rating: number;
  image?: string;
  onAddToCart?: (item: any) => void;
}

export const ServiceCard = ({ 
  id, 
  name, 
  description, 
  price, 
  duration, 
  category, 
  rating, 
  image,
  onAddToCart 
}: ServiceCardProps) => {
  const navigate = useNavigate();

  const handleBookService = () => {
    // Navigate to the full booking flow instead of direct booking
    navigate('/book');
  };

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart({
        id,
        name,
        price,
        quantity: 1
      });
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
      {image && (
        <div className="aspect-video w-full overflow-hidden rounded-t-lg">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-white text-lg">{name}</CardTitle>
          <Badge variant="secondary" className="bg-blue-600/20 text-blue-300">
            {category}
          </Badge>
        </div>
        <div className="flex items-center space-x-4 text-sm text-slate-400">
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{duration} min</span>
          </div>
          <div className="flex items-center space-x-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>{rating}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-slate-300 text-sm">{description}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <span className="text-2xl font-bold text-white">${price}</span>
        <div className="flex space-x-2">
          {onAddToCart && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddToCart}
              className="border-slate-600 text-white hover:bg-slate-700"
            >
              Add to Cart
            </Button>
          )}
          <Button 
            onClick={handleBookService}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Book Service
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
